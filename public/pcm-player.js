class PcmPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunks = [];
    this.position = 0;
    this.ended = false;
    this.finished = false;
    this.port.onmessage = ({ data }) => {
      if (data.type === "audio") this.chunks.push(data.samples);
      if (data.type === "end") this.ended = true;
    };
  }

  process(inputs, outputs) {
    const output = outputs[0][0];
    const step = 24000 / sampleRate;
    for (let i = 0; i < output.length; i++) {
      while (this.chunks.length && this.position >= this.chunks[0].length) {
        this.position -= this.chunks[0].length;
        this.chunks.shift();
      }
      const chunk = this.chunks[0];
      if (!chunk) {
        output[i] = 0;
        continue;
      }
      const index = Math.floor(this.position);
      const fraction = this.position - index;
      const next = chunk[index + 1] ?? this.chunks[1]?.[0] ?? chunk[index];
      output[i] = chunk[index] + (next - chunk[index]) * fraction;
      this.position += step;
    }
    if (this.ended && this.chunks.length === 0 && !this.finished) {
      this.finished = true;
      this.port.postMessage({ type: "drained" });
    }
    return !this.finished;
  }
}

registerProcessor("mimo-pcm-player", PcmPlaybackProcessor);
