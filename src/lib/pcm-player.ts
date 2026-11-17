export class PcmPlayer {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private stopped = false;
  private carry: number | null = null;

  async start() {
    this.context = new AudioContext();
    await this.context.resume();
    await this.context.audioWorklet.addModule("/pcm-player.js");
    if (this.stopped) return;
    this.node = new AudioWorkletNode(this.context, "mimo-pcm-player");
    this.node.connect(this.context.destination);
    this.node.port.onmessage = ({ data }) => {
      if (data.type === "drained") this.stop();
    };
    window.dispatchEvent(new CustomEvent("mimo:play", { detail: "stream" }));
  }

  push(encoded: string) {
    if (!this.node || this.stopped) return;
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length + (this.carry === null ? 0 : 1));
    let offset = 0;
    if (this.carry !== null) bytes[offset++] = this.carry;
    for (let i = 0; i < binary.length; i++)
      bytes[offset + i] = binary.charCodeAt(i);
    this.carry = bytes.length % 2 ? bytes[bytes.length - 1] : null;
    const samples = new Float32Array(Math.floor(bytes.length / 2));
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++)
      samples[i] = view.getInt16(i * 2, true) / 32768;
    this.node.port.postMessage({ type: "audio", samples }, [samples.buffer]);
  }

  finish() {
    this.node?.port.postMessage({ type: "end" });
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.node?.disconnect();
    void this.context?.close();
  }
}
