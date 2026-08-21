// Simple working worker - log when loaded
console.log('VCF Worker: Loading...');

// Ping/pong for testing
self.onmessage = function(e) {
    console.log('VCF Worker: Received message:', e.data);
    
    if (e.data && e.data.type === 'ping') {
        self.postMessage({ type: 'pong', data: { status: 'ok' } });
        return;
    }
    
    // Echo back any message for testing
    self.postMessage({ 
        type: 'echo', 
        data: { 
            original: e.data,
            timestamp: Date.now()
        } 
    );
};

// Handle errors
self.onerror = function(err) {
    console.error('VCF Worker error:', err);
    self.postMessage({ 
        type: 'error', 
        error: 'Worker error: ' + (err.message || err) 
    });
};