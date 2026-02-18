import type {
	ConnectionStatus,
	Language,
	TranscriptionResult,
	ServerMessage,
	ServerInfo
} from './types';

type ResultCallback = (result: TranscriptionResult) => void;
type StatusCallback = (status: ConnectionStatus) => void;

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export class Transcriber {
	private ws: WebSocket | null = null;
	private resultCallbacks: ResultCallback[] = [];
	private statusCallbacks: StatusCallback[] = [];
	private _status: ConnectionStatus = 'disconnected';
	private _serverInfo: ServerInfo | null = null;
	private doneResolve: (() => void) | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectDelay = INITIAL_RECONNECT_DELAY;
	private shouldReconnect = false;
	private currentUrl = '';
	private currentLanguage: Language = 'cs';

	get status(): ConnectionStatus {
		return this._status;
	}

	get serverInfo(): ServerInfo | null {
		return this._serverInfo;
	}

	connect(url: string, language: Language): Promise<void> {
		this.currentUrl = url;
		this.currentLanguage = language;
		this.shouldReconnect = true;
		this.reconnectDelay = INITIAL_RECONNECT_DELAY;

		return this.doConnect(url, language);
	}

	private doConnect(url: string, language: Language): Promise<void> {
		return new Promise((resolve, reject) => {
			this.setStatus('connecting');

			try {
				this.ws = new WebSocket(url);
			} catch (err) {
				this.setStatus('error');
				reject(err);
				return;
			}

			this.ws.binaryType = 'arraybuffer';

			this.ws.onopen = () => {
				// Wait for 'connected' message from server
			};

			this.ws.onmessage = (event: MessageEvent) => {
				if (typeof event.data === 'string') {
					const msg: ServerMessage = JSON.parse(event.data);
					this.handleServerMessage(msg, language, resolve);
				}
			};

			this.ws.onerror = () => {
				this.setStatus('error');
				reject(new Error('WebSocket error'));
			};

			this.ws.onclose = () => {
				const wasReady = this._status === 'ready' || this._status === 'connected';
				this.setStatus('disconnected');
				this.ws = null;

				if (wasReady && this.shouldReconnect) {
					this.scheduleReconnect();
				}
			};
		});
	}

	private handleServerMessage(
		msg: ServerMessage,
		language: Language,
		onReady?: (value: void) => void
	): void {
		switch (msg.type) {
			case 'connected':
				this._serverInfo = {
					backend: msg.backend,
					device: msg.device,
					model: msg.model
				};
				this.setStatus('connected');
				// Send configure
				this.ws?.send(JSON.stringify({ type: 'configure', language }));
				break;

			case 'ready':
				this.setStatus('ready');
				this.reconnectDelay = INITIAL_RECONNECT_DELAY;
				onReady?.();
				break;

			case 'partial':
				this.emitResult({
					text: msg.text,
					startMs: msg.start_ms,
					endMs: msg.end_ms,
					isFinal: false,
					timestamp: Date.now()
				});
				break;

			case 'final':
				this.emitResult({
					text: msg.text,
					startMs: msg.start_ms,
					endMs: msg.end_ms,
					isFinal: true,
					timestamp: Date.now()
				});
				break;

			case 'done':
				this.doneResolve?.();
				this.doneResolve = null;
				break;
		}
	}

	sendAudio(pcmBuffer: ArrayBuffer): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(pcmBuffer);
		}
	}

	stop(): Promise<void> {
		return new Promise((resolve) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				resolve();
				return;
			}

			this.doneResolve = resolve;
			this.ws.send(JSON.stringify({ type: 'stop' }));

			// Timeout in case server doesn't respond
			setTimeout(() => {
				if (this.doneResolve) {
					this.doneResolve();
					this.doneResolve = null;
				}
			}, 5000);
		});
	}

	disconnect(): void {
		this.shouldReconnect = false;
		this.clearReconnectTimer();
		this.doneResolve?.();
		this.doneResolve = null;
		this.ws?.close();
		this.ws = null;
		this.setStatus('disconnected');
	}

	onResult(cb: ResultCallback): () => void {
		this.resultCallbacks.push(cb);
		return () => {
			this.resultCallbacks = this.resultCallbacks.filter((c) => c !== cb);
		};
	}

	onStatusChange(cb: StatusCallback): () => void {
		this.statusCallbacks.push(cb);
		return () => {
			this.statusCallbacks = this.statusCallbacks.filter((c) => c !== cb);
		};
	}

	private setStatus(status: ConnectionStatus): void {
		this._status = status;
		this.statusCallbacks.forEach((cb) => cb(status));
	}

	private emitResult(result: TranscriptionResult): void {
		this.resultCallbacks.forEach((cb) => cb(result));
	}

	private scheduleReconnect(): void {
		this.clearReconnectTimer();
		this.reconnectTimer = setTimeout(() => {
			if (this.shouldReconnect) {
				this.doConnect(this.currentUrl, this.currentLanguage).catch(() => {
					// Exponential backoff
					this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
					this.scheduleReconnect();
				});
			}
		}, this.reconnectDelay);
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}
}

export const transcriber = new Transcriber();
