class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._target = 2048;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this._buffer.push(channel[i]);
      }
      while (this._buffer.length >= this._target) {
        const frame = this._buffer.splice(0, this._target);
        this.port.postMessage(new Float32Array(frame));
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
