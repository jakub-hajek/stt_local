export type Language = 'cs' | 'sk' | 'en' | 'auto';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'ready' | 'error';

export type ModelStatus = 'idle' | 'checking' | 'ready' | 'error' | 'server_offline';

export interface TranscriptionResult {
	text: string;
	startMs: number;
	endMs: number;
	isFinal: boolean;
	timestamp: number;
}

export interface ServerInfo {
	backend: string;
	device: string;
	model: string;
}

export interface HealthResponse {
	status: string;
	backend: string;
	device: string;
	model: string;
	version: string;
}

/** Messages sent by the server */
export interface ServerConnectedMessage {
	type: 'connected';
	backend: string;
	device: string;
	model: string;
}

export interface ServerReadyMessage {
	type: 'ready';
}

export interface ServerPartialMessage {
	type: 'partial';
	text: string;
	start_ms: number;
	end_ms: number;
}

export interface ServerFinalMessage {
	type: 'final';
	text: string;
	start_ms: number;
	end_ms: number;
}

export interface ServerDoneMessage {
	type: 'done';
}

export type ServerMessage =
	| ServerConnectedMessage
	| ServerReadyMessage
	| ServerPartialMessage
	| ServerFinalMessage
	| ServerDoneMessage;
