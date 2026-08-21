console.log('Test worker loading...');

self.onmessage = function(e) {
    console.log('Test worker received:', e.data);
    self.postMessage({ type: 'progress', data: { stage: 'test', text: 'Worker works!' }});
};

console.log('Test worker loaded successfully');