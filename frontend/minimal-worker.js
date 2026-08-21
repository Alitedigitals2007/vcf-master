self.onmessage = function(e) {
    self.postMessage({ type: 'progress', data: { stage: 'test', text: 'Minimal worker works!' }});
};