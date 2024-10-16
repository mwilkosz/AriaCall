import React, { useEffect, useState, useRef, useCallback } from 'react';
import './LeftPanel.css';

function LeftPanel({ onCallEnded }) {
  const [conversationStarted, setConversationStarted] = useState(false);
  const [output, setOutput] = useState([]);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const microphoneAudioContextRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const microphoneProcessorRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationIdRef = useRef(null);
  const ballRef = useRef(null);

  const visualizeFrequency = useCallback(() => {
    animationIdRef.current = requestAnimationFrame(visualizeFrequency);

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);

    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const avgFrequency = sum / dataArrayRef.current.length;

    const minScale = 1;
    const maxScale = 4;
    const scaleFactor = minScale + ((avgFrequency / 255) * (maxScale - minScale));

    if (ballRef.current) {
      ballRef.current.style.transform = `scale(${scaleFactor})`;
    }
  }, []);

  const animateBall = useCallback((start) => {
    if (!start && ballRef.current) {
      ballRef.current.style.transform = 'scale(1)';
      cancelAnimationFrame(animationIdRef.current);
    }
  }, []);

  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      cancelAnimationFrame(animationIdRef.current);
      animateBall(false);
      return;
    }

    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift();
    const audio = new Audio(`data:audio/wav;base64,${audioData}`);
    currentAudioRef.current = audio;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const source = audioContextRef.current.createMediaElementSource(audio);

    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
    }

    source.connect(analyserRef.current);
    analyserRef.current.connect(audioContextRef.current.destination);

    audio.onended = () => {
      source.disconnect();
      playNextAudio();
    };

    audio.play().then(() => {
      visualizeFrequency();
    }).catch(() => {
      playNextAudio();
    });
  }, [animateBall, visualizeFrequency]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000/connection');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to server');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received message from server:', data);

      if (data.event === 'media' && data.media && data.media.payload) {
        audioQueueRef.current.push(data.media.payload);
        if (!isPlayingRef.current) {
          playNextAudio();
        }
      }

      if (data.partialResponse) {
        setOutput((prevOutput) => [...prevOutput, data.partialResponse]);
      }
    };

    return () => {
      ws.close();
    };
  }, [playNextAudio]);

  const startMicrophone = () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        microphoneAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        microphoneStreamRef.current = microphoneAudioContextRef.current.createMediaStreamSource(stream);

        microphoneProcessorRef.current = microphoneAudioContextRef.current.createScriptProcessor(2048, 1, 1);
        microphoneStreamRef.current.connect(microphoneProcessorRef.current);
        microphoneProcessorRef.current.connect(microphoneAudioContextRef.current.destination);

        microphoneProcessorRef.current.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const downsampledBuffer = downsampleBuffer(inputData, microphoneAudioContextRef.current.sampleRate, 8000);
          const encodedData = encodeMuLaw(downsampledBuffer);
          const base64data = btoa(String.fromCharCode.apply(null, encodedData));

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              event: 'media',
              media: { payload: base64data },
            }));
          }
        };
      })
      .catch((err) => {
        console.error('Error accessing microphone:', err);
      });
  };

  const stopMicrophone = () => {
    if (microphoneProcessorRef.current) {
      microphoneProcessorRef.current.disconnect();
      microphoneProcessorRef.current.onaudioprocess = null;
      microphoneProcessorRef.current = null;
    }
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.disconnect();
      microphoneStreamRef.current = null;
    }
    if (microphoneAudioContextRef.current) {
      microphoneAudioContextRef.current.close();
      microphoneAudioContextRef.current = null;
    }
  };

  const stopAudioPlayback = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;
    }
    isPlayingRef.current = false;
    audioQueueRef.current = [];
    animateBall(false);
  };

  const downsampleBuffer = (buffer, sampleRate, outSampleRate) => {
    if (outSampleRate === sampleRate) {
      return buffer;
    }
    if (outSampleRate > sampleRate) {
      throw new Error('Downsampling rate should be lower than original sampling frequency');
    }
    const sampleRateRatio = sampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  const encodeMuLaw = (samples) => {
    const MULAW_MAX = 0x1FFF;
    const MULAW_BIAS = 33;
    const encoded = new Uint8Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      let sample = samples[i];
      sample = Math.max(-1, Math.min(1, sample));
      sample *= MULAW_MAX;
      const sign = sample < 0 ? 0x80 : 0;
      sample = Math.abs(sample);
      sample += MULAW_BIAS;
      if (sample > MULAW_MAX) {
        sample = MULAW_MAX;
      }
      const exponent = Math.floor(Math.log(sample) / Math.log(2));
      const mantissa = (sample >> (exponent - 3)) & 0x0F;
      const muLawByte = ~(sign | ((exponent - 5) << 4) | mantissa);
      encoded[i] = muLawByte;
    }
    return encoded;
  };

  const handleStart = () => {
    if (conversationStarted) return;

    setConversationStarted(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: 'start',
        message: 'Starting conversation',
      }));
    }

    startMicrophone();
  };

  const handleStop = () => {
    if (!conversationStarted) return;

    stopMicrophone();
    stopAudioPlayback();

    setConversationStarted(false);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: 'stop',
        message: 'Ending conversation',
      }));
    }

    if (onCallEnded) {
      onCallEnded();
    }
  };

  return (
    <div className="left-panel">
      <h1>Przetestuj AriaCall!</h1>

      <div id="visual">
        <div id="ball" ref={ballRef}></div>
      </div>

      <div className="button-container">
        <button onClick={handleStart} disabled={conversationStarted}>
          Zadzwoń
        </button>
        <button onClick={handleStop} disabled={!conversationStarted}>
          Zawieś
        </button>
      </div>

      <div id="output">
        {output.map((text, index) => (
          <p key={index}>{text}</p>
        ))}
      </div>
    </div>
  );
}

export default LeftPanel;