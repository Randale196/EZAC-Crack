(function () {
  var res = window.GetParentResourceName ? window.GetParentResourceName() : 'EZAC';

  function ezacLog(msg) {
    try { fetch('https://' + res + '/EZAC:DebugLog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg: msg }) }).catch(function(){}); } catch(_) {}
  }

  var _cfxCanvas = null;
  var _cfxGl = null;
  var _cfxProgram = null;
  var _cfxTex = null;
  var _cfxRafId = null;
  var _cfxStream = null;

  function initCfxCanvas() {
    if (_cfxCanvas) return true;
    try {
      _cfxCanvas = document.createElement('canvas');
      _cfxCanvas.width = window.innerWidth || 1920;
      _cfxCanvas.height = window.innerHeight || 1080;
      _cfxCanvas.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-9999;';
      document.body.appendChild(_cfxCanvas);

      _cfxGl = _cfxCanvas.getContext('webgl', {
        preserveDrawingBuffer: true,
      }) || _cfxCanvas.getContext('experimental-webgl', {
        preserveDrawingBuffer: true,
      });
      if (!_cfxGl) { ezacLog('CfxTexture: WebGL not available'); _cfxCanvas = null; return false; }
      var gl = _cfxGl;

      _cfxTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, _cfxTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3));
      gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
      gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

      var vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs,
        'attribute vec2 position;\n' +
        'varying vec2 vUv;\n' +
        'void main() {\n' +
        '  vUv = vec2((position.x + 1.0) / 2.0, (position.y + 1.0) / 2.0);\n' +
        '  gl_Position = vec4(position, 0.0, 1.0);\n' +
        '}'
      );
      gl.compileShader(vs);

      var fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs,
        'precision mediump float;\n' +
        'varying vec2 vUv;\n' +
        'uniform sampler2D tDiffuse;\n' +
        'void main() {\n' +
        '  gl_FragColor = texture2D(tDiffuse, vUv);\n' +
        '}'
      );
      gl.compileShader(fs);

      _cfxProgram = gl.createProgram();
      gl.attachShader(_cfxProgram, vs);
      gl.attachShader(_cfxProgram, fs);
      gl.linkProgram(_cfxProgram);
      gl.useProgram(_cfxProgram);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var posLoc = gl.getAttribLocation(_cfxProgram, 'position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      ezacLog('CfxTexture: WebGL canvas initialized ' + _cfxCanvas.width + 'x' + _cfxCanvas.height);
      return true;
    } catch (e) {
      ezacLog('CfxTexture: init error: ' + (e && e.message ? e.message : String(e)));
      _cfxCanvas = null;
      return false;
    }
  }

  var _cfxFrameCount = 0;
  var _cfxDiagFrames = [1, 30, 120]; 

  function cfxRenderFrame() {
    if (!_cfxGl || !_cfxCanvas) return;
    var gl = _cfxGl;
    if (_cfxCanvas.width !== (window.innerWidth || 1920) || _cfxCanvas.height !== (window.innerHeight || 1080)) {
      _cfxCanvas.width = window.innerWidth || 1920;
      _cfxCanvas.height = window.innerHeight || 1080;
    }
    gl.viewport(0, 0, _cfxCanvas.width, _cfxCanvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(_cfxProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, _cfxTex);
    gl.uniform1i(gl.getUniformLocation(_cfxProgram, 'tDiffuse'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();

    _cfxFrameCount++;
    if (_cfxDiagFrames.indexOf(_cfxFrameCount) !== -1) {
      try {
        var px = new Uint8Array(4);
        gl.readPixels(Math.floor(_cfxCanvas.width / 2), Math.floor(_cfxCanvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        var hasColor = px[0] > 5 || px[1] > 5 || px[2] > 5;
        ezacLog('CfxTexture: frame ' + _cfxFrameCount + ' center pixel RGBA=' + px[0] + ',' + px[1] + ',' + px[2] + ',' + px[3] +
          (hasColor ? ' (HAS COLOR — game capture working!)' : ' (dark — waiting for game content)'));
      } catch (e) {}
    }
  }

  function startCfxCapture(fps) {
    if (!initCfxCanvas()) return null;
    _cfxFrameCount = 0; 
    if (!_cfxRafId) {
      function loop() {
        cfxRenderFrame();
        _cfxRafId = requestAnimationFrame(loop);
      }
      _cfxRafId = requestAnimationFrame(loop);
    }
    if (!_cfxStream) {
      _cfxStream = _cfxCanvas.captureStream(fps || 24);
      ezacLog('CfxTexture: captureStream started at ' + (fps || 24) + ' fps');
    }
    return _cfxStream;
  }

  function stopCfxCapture() {
    if (_cfxRafId) {
      cancelAnimationFrame(_cfxRafId);
      _cfxRafId = null;
    }
    if (_cfxStream) {
      try { _cfxStream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
      _cfxStream = null;
    }
  }

  function cfxTakeScreenshot(quality) {
    if (!initCfxCanvas()) return null;
    cfxRenderFrame();
    return _cfxCanvas.toDataURL('image/jpeg', quality || 0.85);
  }

  var webrtcPcs = {};    
  var webrtcStreams = {}; 

  function cleanupStream(streamId) {
    if (webrtcPcs[streamId]) {
      try { webrtcPcs[streamId].close(); } catch (_) {}
      delete webrtcPcs[streamId];
    }
    if (webrtcStreams[streamId]) {
      delete webrtcStreams[streamId];
    }
    if (Object.keys(webrtcPcs).length === 0 && !_bufferActive) {
      stopCfxCapture();
    }
  }

  var _apiBaseUrl = null;
  var _apiKey = null;

  function doStartStreamTop(payload) {
    if (!payload || !payload.streamId) return;
    var streamId = payload.streamId;
    if (webrtcPcs[streamId]) return;
    if (payload.apiBaseUrl) _apiBaseUrl = payload.apiBaseUrl.replace(/\/+$/, '');
    if (payload.key) _apiKey = payload.key;
    (async function () {
      try {
        var iceServers = Array.isArray(payload.iceServers) ? payload.iceServers : [{ urls: 'stun:stun.l.google.com:19302' }];
        ezacLog('WebRTC: starting CfxTexture capture for streamId=' + streamId);
        var stream = startCfxCapture(24);
        if (!stream) {
          ezacLog('WebRTC: CfxTexture capture failed — no stream');
          return;
        }
        webrtcStreams[streamId] = stream;
        var pc = new RTCPeerConnection({ iceServers: iceServers });
        webrtcPcs[streamId] = pc;
        stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
        var offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await new Promise(function (resolve) {
          if (pc.iceGatheringState === 'complete') { resolve(); return; }
          pc.onicegatheringstatechange = function () { if (pc && pc.iceGatheringState === 'complete') resolve(); };
          setTimeout(resolve, 5000);
        });
        var candidateCount = (pc.localDescription && pc.localDescription.sdp ? (pc.localDescription.sdp.match(/a=candidate/g) || []).length : 0);
        ezacLog('WebRTC: ICE gathered, sending offer for streamId=' + streamId + ' candidates=' + candidateCount);

        var offerSent = false;
        if (_apiBaseUrl && _apiKey) {
          try {
            var apiUrl = _apiBaseUrl + '/api/ezac/webrtc/offer';
            ezacLog('WebRTC: posting offer directly to API: ' + apiUrl);
            var resp = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: _apiKey, streamId: streamId, offer: pc.localDescription }),
            });
            var respText = await resp.text();
            ezacLog('WebRTC: API offer response status=' + resp.status + ' body=' + respText.substring(0, 200));
            if (resp.ok) offerSent = true;
          } catch (apiErr) {
            ezacLog('WebRTC: direct API POST failed: ' + (apiErr && apiErr.message ? apiErr.message : String(apiErr)));
          }
        }

        if (!offerSent) {
          ezacLog('WebRTC: falling back to Lua relay for streamId=' + streamId);
          await fetch('https://' + res + '/webrtc_event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType: 'offer', data: { streamId: streamId, offer: pc.localDescription } }),
          });
          ezacLog('WebRTC: offer sent to Lua for streamId=' + streamId);
        }
      } catch (e) {
        ezacLog('WebRTC: doStartStreamTop error for streamId=' + streamId + ': ' + (e && e.message ? e.message : String(e)));
        cleanupStream(streamId);
      }
    })();
  }

  var audioStream = null;
  var audioRecorder = null;
  var audioWs = null;
  var audioActive = false;
  var pendingAudioCfg = null;

  var _bufferActive = false;
  var _bufferRecorder = null;
  var _bufferSegmentTimer = null;
  var _bufferMime = null;
  var _bufferStream = null;
  var _rollingSegments = []; 
  var _currentSegmentChunks = [];
  var _currentSegmentStart = 0;
  var SEGMENT_DURATION_MS = 5000; 
  var MAX_SEGMENTS = 4;           

  function startRollingBuffer() {
    if (_bufferActive) return;
    if (!window.MediaRecorder) return;
    _bufferStream = startCfxCapture(24);
    if (!_bufferStream) { ezacLog('RollingBuffer: CfxTexture capture not available'); return; }
    _bufferMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : null;
    if (!_bufferMime) { ezacLog('RollingBuffer: no supported mimeType'); return; }
    _bufferActive = true;
    _rollingSegments = [];
    ezacLog('RollingBuffer: started (' + _bufferMime + ', ' + SEGMENT_DURATION_MS + 'ms segments)');
    _startNewSegment();
  }

  function _startNewSegment() {
    if (!_bufferActive || !_bufferStream || !_bufferStream.active) return;
    _currentSegmentChunks = [];
    _currentSegmentStart = Date.now();
    try {
      var rec = new MediaRecorder(_bufferStream, { mimeType: _bufferMime });
      _bufferRecorder = rec;
      rec.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) _currentSegmentChunks.push(e.data);
      };
      rec.onstop = function() {
        if (_currentSegmentChunks.length > 0) {
          _rollingSegments.push({
            blob: new Blob(_currentSegmentChunks, { type: _bufferMime }),
            startTime: _currentSegmentStart,
          });
          if (_rollingSegments.length > MAX_SEGMENTS) _rollingSegments.shift();
        }
        _bufferRecorder = null;
        _currentSegmentChunks = [];
        if (_bufferActive) _startNewSegment();
      };
      rec.start();
      _bufferSegmentTimer = setTimeout(function() {
        if (rec.state !== 'inactive') rec.stop();
      }, SEGMENT_DURATION_MS);
    } catch (e) {
      ezacLog('RollingBuffer: segment start error: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function _stopCurrentSegment() {
    return new Promise(function(resolve) {
      if (_bufferSegmentTimer) { clearTimeout(_bufferSegmentTimer); _bufferSegmentTimer = null; }
      if (!_bufferRecorder || _bufferRecorder.state === 'inactive') { resolve(); return; }
      var rec = _bufferRecorder;
      var origOnStop = rec.onstop;
      rec.onstop = function(e) {
        if (origOnStop) origOnStop.call(rec, e);
        resolve();
      };
      rec.stop();
    });
  }

  function stopScreenshareAudio() {
    audioActive = false;
    pendingAudioCfg = null;
    if (audioRecorder) {
      try { audioRecorder.stop(); } catch (e) {}
      audioRecorder = null;
    }
    if (audioStream) {
      try { audioStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      audioStream = null;
    }
    if (audioWs) {
      try { audioWs.close(); } catch (e) {}
      audioWs = null;
    }
  }

  function makeScreenshareWsUrl(baseUrl, playerId) {
    if (!baseUrl) return null;
    try {
      var u = new URL(baseUrl);
      var proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      var query = 'playerId=' + encodeURIComponent(playerId || '');
      return proto + '//' + u.host + '/api/ezac/screenshare/audio?' + query;
    } catch (e) {
      return null;
    }
  }

  function tryGetUserMedia(constraints, cb) {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia(constraints).then(function (s) { cb(s, null); }).catch(function (e) { cb(null, e); });
      return;
    }
    var fn = navigator.getUserMedia || navigator.webkitGetUserMedia;
    if (fn) {
      fn.call(navigator, constraints, function (s) { cb(s, null); }, function (e) { cb(null, e || new Error('getUserMedia failed')); });
    } else {
      cb(null, new Error('getUserMedia not available'));
    }
  }

  function doStartStreaming(stream, wsUrl) {
    if (!audioActive) {
      try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      return;
    }
    audioStream = stream;
    audioWs = new WebSocket(wsUrl);
    audioWs.binaryType = 'arraybuffer';
    audioWs.onclose = function () { audioWs = null; };
    audioWs.onerror = function () { audioWs = null; };
    try {
      audioRecorder = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
        : new MediaRecorder(stream);
    } catch (e) {
      audioRecorder = null;
    }
    if (!audioRecorder) {
      stopScreenshareAudio();
      return;
    }
    audioRecorder.ondataavailable = function (ev) {
      if (!audioActive || !audioWs || audioWs.readyState !== 1) return;
      if (!ev.data || !ev.data.size) return;
      ev.data.arrayBuffer().then(function (buf) {
        if (!audioActive || !audioWs || audioWs.readyState !== 1) return;
        audioWs.send(buf);
      }).catch(function () {});
    };
    audioRecorder.start(500);
  }

  function startScreenshareAudio(cfg) {
    if (!window.MediaRecorder) return;
    var wsUrl = makeScreenshareWsUrl(cfg && cfg.baseUrl, cfg && cfg.playerId);
    if (!wsUrl) return;
    stopScreenshareAudio();
    audioActive = true;
    pendingAudioCfg = cfg;
    var attempts = [
      { audio: true },
      { audio: { echoCancellation: false, noiseSuppression: false } }
    ];
    function attempt(i) {
      if (!audioActive) return;
      if (i >= attempts.length) {
        ezacLog('ScreenshareAudio: no audio source available in CEF');
        stopScreenshareAudio();
        return;
      }
      tryGetUserMedia(attempts[i], function (stream, err) {
        if (stream) {
          doStartStreaming(stream, wsUrl);
        } else {
          attempt(i + 1);
        }
      });
    }
    attempt(0);
  }

  var _pollDelay = 3000;
  var _pollFails = 0;
  var _pollTimer = null;

  function pullPendingStream() {
    fetch('https://' + res + '/EZAC:GetPendingStream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.streamId && !webrtcPcs[data.streamId]) {
          doStartStreamTop(data);
        }
        _pollDelay = 3000;
        _pollFails = 0;
        schedulePoll();
      })
      .catch(function () {
        _pollFails++;
        _pollDelay = Math.min(_pollDelay * 2, 30000);
        if (_pollFails < 30) schedulePoll();
      });
  }

  function schedulePoll() {
    if (_pollTimer) clearTimeout(_pollTimer);
    _pollTimer = setTimeout(pullPendingStream, _pollDelay);
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch(err) { return; }
    }
    if (!d || typeof d !== 'object') return;

    if (_pollFails > 0) { _pollFails = 0; _pollDelay = 3000; schedulePoll(); }

    if (d.type === 'start_stream') {
      doStartStreamTop(d.data || {});
    }

    if (d.type === 'stop_stream') {
      var stopId = d.streamId;
      if (stopId) {
        cleanupStream(stopId);
      } else {
        Object.keys(webrtcPcs).forEach(function (sid) { cleanupStream(sid); });
      }
    }

    if (d.type === 'screenshareAudio') {
      if (d.active) {
        startScreenshareAudio(d);
      } else {
        stopScreenshareAudio();
      }
    }

    if (d.type === 'webrtc_answer') {
      (async function() {
        try {
          var sid = (d.data || {}).streamId;
          var pc = sid && webrtcPcs[sid];
          if (!pc) { ezacLog('WebRTC: webrtc_answer — no PC for streamId=' + sid); return; }
          var answer = (d.data || {}).answer;
          if (!answer) return;
          ezacLog('WebRTC: setting remote description (answer) for streamId=' + sid);
          await pc.setRemoteDescription(answer);
          ezacLog('WebRTC: remote description set for streamId=' + sid);
        } catch(e) {
          ezacLog('WebRTC: answer error: ' + (e && e.message ? e.message : String(e)));
        }
      })();
    }

    if (d.command === 'START_RECORDING') {
      startRollingBuffer();
    }

    if (d.command === 'SEND_LAST_RECORDING') {
      (async function() {
        var uploadUrl = d.uploadUrl;
        var banId = d.banId || '';
        var EVIDENCE_RECORD_MS = 4000; 
        function notifyUploadDone() {
          if (!banId) return;
          try {
            fetch('https://' + res + '/EZAC:EvidenceUploadDone', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ banId: banId })
            }).catch(function() {});
          } catch (e) {}
        }
        try {
          if (!uploadUrl) { notifyUploadDone(); return; }

          _bufferActive = false;
          if (_bufferSegmentTimer) { clearTimeout(_bufferSegmentTimer); _bufferSegmentTimer = null; }
          if (_bufferRecorder && _bufferRecorder.state !== 'inactive') {
            try { _bufferRecorder.stop(); } catch (_) {}
          }
          _bufferRecorder = null;

          ezacLog('SEND_LAST_RECORDING: starting fresh ' + EVIDENCE_RECORD_MS + 'ms capture');
          var captureStream = startCfxCapture(24);
          if (!captureStream) {
            ezacLog('SEND_LAST_RECORDING: no capture stream available');
            notifyUploadDone();
            return;
          }
          var mime = _bufferMime
            || (MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm');
          var evidenceRecorder = new MediaRecorder(captureStream, { mimeType: mime });
          var evidenceChunks = [];
          evidenceRecorder.ondataavailable = function(e) {
            if (e.data && e.data.size > 0) evidenceChunks.push(e.data);
          };
          evidenceRecorder.start(); 

          await new Promise(function(r) { setTimeout(r, EVIDENCE_RECORD_MS); });

          await new Promise(function(resolve) {
            evidenceRecorder.onstop = function() { resolve(); };
            evidenceRecorder.stop();
          });

          if (evidenceChunks.length > 0) {
            var blob = new Blob(evidenceChunks, { type: mime });
            var fd = new FormData();
            fd.append('file', blob, 'clip.webm');
            var resp = await fetch(uploadUrl, { method: 'POST', body: fd });
            ezacLog('SEND_LAST_RECORDING: uploaded ' + Math.round(blob.size / 1024) + 'KB, status=' + resp.status);
          } else {
            ezacLog('SEND_LAST_RECORDING: no data captured');
          }
          notifyUploadDone();

          _rollingSegments = [];
          _bufferActive = true;
          _startNewSegment();
        } catch(e) {
          ezacLog('SEND_LAST_RECORDING error: ' + (e && e.message ? e.message : String(e)));
          notifyUploadDone();
          if (!_bufferActive) { _bufferActive = true; _startNewSegment(); }
        }
      })();
    }

    if (d.type === 'admin_screenshot') {
      (async function() {
        try {
          var uploadUrl = d.uploadUrl;
          if (!uploadUrl) return;
          var dataUrl = cfxTakeScreenshot(0.85);
          if (!dataUrl) { ezacLog('admin_screenshot: CfxTexture capture failed'); return; }
          var byteString = atob(dataUrl.split(',')[1]);
          var mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
          var ab = new ArrayBuffer(byteString.length);
          var ia = new Uint8Array(ab);
          for (var i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
          var blob = new Blob([ab], { type: mimeString });
          var fd = new FormData();
          fd.append('image', blob, 'screenshot.jpg');
          await fetch(uploadUrl, { method: 'POST', body: fd });
          ezacLog('admin_screenshot: uploaded');
        } catch(e) {
          ezacLog('admin_screenshot error: ' + (e && e.message ? e.message : String(e)));
        }
      })();
    }
  });

  _pollTimer = setTimeout(pullPendingStream, 3000);
})();
