// Logger estruturado para CloudWatch com tags e formatação consistente

export function log(tag, message, data = null) {
  const timestamp = new Date().toISOString();
  if (data !== null) {
    const formatted = typeof data === 'object' ? JSON.stringify(data) : data;
    console.log(`[${timestamp}] [${tag}] ${message} => ${formatted}`);
  } else {
    console.log(`[${timestamp}] [${tag}] ${message}`);
  }
}

export function logError(tag, message, err = null) {
  const timestamp = new Date().toISOString();
  if (err !== null) {
    const details = err && err.stack ? err.stack : (typeof err === 'object' ? JSON.stringify(err) : err);
    console.error(`[${timestamp}] [ERRO][${tag}] ${message} => ${details}`);
  } else {
    console.error(`[${timestamp}] [ERRO][${tag}] ${message}`);
  }
}
