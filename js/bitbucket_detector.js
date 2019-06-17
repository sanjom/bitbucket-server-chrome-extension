if (typeof window.define !== 'undefined' && typeof window.require !== 'undefined' && typeof window.bitbucket !== 'undefined') {
	window.postMessage({ bitbucketDetected: true }, '*');
}
