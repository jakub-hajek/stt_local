import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transcriber } from './transcriber';

describe('Transcriber', () => {
	let transcriber: Transcriber;
	let mockWs: any;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		transcriber = new Transcriber();
	});

	afterEach(() => {
		vi.useRealTimers();
		transcriber.disconnect();
	});

	function simulateConnect(language = 'cs') {
		const connectPromise = transcriber.connect('ws://localhost:8765/ws/transcribe', language as any);

		mockWs = (transcriber as any).ws;

		// Simulate server sending 'connected'
		mockWs.onmessage?.({
			data: JSON.stringify({
				type: 'connected',
				backend: 'faster-whisper',
				device: 'cpu',
				model: 'large-v3-turbo'
			})
		});

		// Simulate server sending 'ready'
		mockWs.onmessage?.({
			data: JSON.stringify({ type: 'ready' })
		});

		return connectPromise;
	}

	it('starts in disconnected state', () => {
		expect(transcriber.status).toBe('disconnected');
		expect(transcriber.serverInfo).toBeNull();
	});

	it('connects and receives server info', async () => {
		await simulateConnect();

		expect(transcriber.status).toBe('ready');
		expect(transcriber.serverInfo).toEqual({
			backend: 'faster-whisper',
			device: 'cpu',
			model: 'large-v3-turbo'
		});
	});

	it('sends configure message with language', async () => {
		await simulateConnect('cs');

		expect(mockWs.send).toHaveBeenCalledWith(
			JSON.stringify({ type: 'configure', language: 'cs' })
		);
	});

	it('sendAudio sends binary data when WS is open', async () => {
		await simulateConnect();

		const buffer = new ArrayBuffer(3200);
		transcriber.sendAudio(buffer);

		expect(mockWs.send).toHaveBeenCalledWith(buffer);
	});

	it('sendAudio does nothing when WS is not open', () => {
		// No connection — ws is null
		transcriber.sendAudio(new ArrayBuffer(100));
		// Should not throw
	});

	it('sendAudio does nothing when WS readyState is not OPEN', async () => {
		await simulateConnect();
		mockWs.readyState = 3; // CLOSED

		const sendCallsBefore = mockWs.send.mock.calls.length;
		transcriber.sendAudio(new ArrayBuffer(100));
		// send should not have been called again (only the configure call from connect)
		expect(mockWs.send.mock.calls.length).toBe(sendCallsBefore);
	});

	it('onResult receives partial results', async () => {
		const cb = vi.fn();
		transcriber.onResult(cb);
		await simulateConnect();

		mockWs.onmessage?.({
			data: JSON.stringify({ type: 'partial', text: 'Ahoj', start_ms: 0, end_ms: 1000 })
		});

		expect(cb).toHaveBeenCalledWith(
			expect.objectContaining({ text: 'Ahoj', startMs: 0, endMs: 1000, isFinal: false })
		);
	});

	it('onResult receives final results', async () => {
		const cb = vi.fn();
		transcriber.onResult(cb);
		await simulateConnect();

		mockWs.onmessage?.({
			data: JSON.stringify({ type: 'final', text: 'Ahoj světe', start_ms: 0, end_ms: 2000 })
		});

		expect(cb).toHaveBeenCalledWith(
			expect.objectContaining({ text: 'Ahoj světe', isFinal: true })
		);
	});

	it('onResult unsubscribe works', async () => {
		const cb = vi.fn();
		const unsub = transcriber.onResult(cb);
		unsub();
		await simulateConnect();

		mockWs.onmessage?.({
			data: JSON.stringify({ type: 'partial', text: 'test', start_ms: 0, end_ms: 1000 })
		});

		expect(cb).not.toHaveBeenCalled();
	});

	it('onStatusChange fires on status changes', async () => {
		const statuses: string[] = [];
		transcriber.onStatusChange((s) => statuses.push(s));
		await simulateConnect();

		expect(statuses).toContain('connecting');
		expect(statuses).toContain('connected');
		expect(statuses).toContain('ready');
	});

	it('onStatusChange unsubscribe works', async () => {
		const statuses: string[] = [];
		const unsub = transcriber.onStatusChange((s) => statuses.push(s));
		unsub();

		await simulateConnect();

		expect(statuses).toEqual([]);
	});

	it('stop sends stop message and resolves on done', async () => {
		await simulateConnect();

		const stopPromise = transcriber.stop();

		mockWs.onmessage?.({
			data: JSON.stringify({ type: 'done' })
		});

		await stopPromise;

		expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'stop' }));
	});

	it('stop resolves immediately when WS is null', async () => {
		// Not connected
		await transcriber.stop();
		// Should not throw
	});

	it('stop resolves immediately when WS is not open', async () => {
		await simulateConnect();
		mockWs.readyState = 3; // CLOSED

		await transcriber.stop();
		// Should resolve without sending
	});

	it('stop resolves via timeout if server never sends done', async () => {
		await simulateConnect();

		const stopPromise = transcriber.stop();

		// Advance past the 5s timeout
		vi.advanceTimersByTime(6000);

		await stopPromise;
	});

	it('disconnect closes WebSocket', async () => {
		await simulateConnect();

		transcriber.disconnect();

		expect(mockWs.close).toHaveBeenCalled();
		expect(transcriber.status).toBe('disconnected');
	});

	it('disconnect resolves pending done', async () => {
		await simulateConnect();

		let stopResolved = false;
		const stopPromise = transcriber.stop().then(() => { stopResolved = true; });

		transcriber.disconnect();

		// The doneResolve should have been called
		await stopPromise;
		expect(stopResolved).toBe(true);
	});

	it('disconnect when not connected is safe', () => {
		transcriber.disconnect();
		expect(transcriber.status).toBe('disconnected');
	});

	it('onerror sets error status', () => {
		const connectPromise = transcriber.connect('ws://localhost:8765/ws/transcribe', 'cs');
		mockWs = (transcriber as any).ws;

		mockWs.onerror?.(new Event('error'));

		expect(transcriber.status).toBe('error');
		// The promise should reject
		return expect(connectPromise).rejects.toThrow('WebSocket error');
	});

	it('onclose after ready triggers reconnect', async () => {
		await simulateConnect();

		expect(transcriber.status).toBe('ready');

		// Simulate close
		mockWs.onclose?.();
		expect(transcriber.status).toBe('disconnected');

		// Advance timer to trigger reconnect
		vi.advanceTimersByTime(1500);

		// A new WebSocket should have been created
		const newWs = (transcriber as any).ws;
		expect(newWs).not.toBeNull();
	});

	it('onclose when not ready does not trigger reconnect', () => {
		const connectPromise = transcriber.connect('ws://localhost:8765/ws/transcribe', 'cs');
		mockWs = (transcriber as any).ws;

		// Reject via error first so promise settles
		mockWs.onerror?.(new Event('error'));
		connectPromise.catch(() => {}); // suppress unhandled rejection

		// Now close — status is 'error', not 'ready' or 'connected'
		mockWs.onclose?.();

		vi.advanceTimersByTime(5000);

		// Should not have reconnected
		expect((transcriber as any).reconnectTimer).toBeNull();
	});

	it('disconnect cancels pending reconnect timer', async () => {
		await simulateConnect();
		mockWs.onclose?.();

		// Reconnect timer should be scheduled
		expect((transcriber as any).reconnectTimer).not.toBeNull();

		transcriber.disconnect();

		expect((transcriber as any).reconnectTimer).toBeNull();
	});

	it('done message resolves stop promise', async () => {
		await simulateConnect();

		let resolved = false;
		const stopPromise = transcriber.stop().then(() => { resolved = true; });

		// Trigger done
		mockWs.onmessage?.({
			data: JSON.stringify({ type: 'done' })
		});

		await stopPromise;
		expect(resolved).toBe(true);
	});

	it('done message when no stop pending is harmless', async () => {
		await simulateConnect();

		// Send done without a pending stop
		mockWs.onmessage?.({
			data: JSON.stringify({ type: 'done' })
		});
		// Should not throw
	});
});
