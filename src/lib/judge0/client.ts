const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || '';

interface SubmitParams {
  source_code: string;
  language_id: number;
  stdin?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
}

interface Judge0Result {
  status: { id: number; description: string };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;
  memory: number | null;
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (JUDGE0_API_URL.includes('rapidapi.com')) {
    h['X-RapidAPI-Key'] = JUDGE0_API_KEY;
    h['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
  } else if (JUDGE0_API_KEY) {
    h['X-Auth-Token'] = JUDGE0_API_KEY;
  }
  return h;
}

export async function submitCode(params: SubmitParams): Promise<string> {
  const body = {
    source_code: Buffer.from(params.source_code).toString('base64'),
    language_id: params.language_id,
    stdin: params.stdin ? Buffer.from(params.stdin).toString('base64') : null,
    cpu_time_limit: params.cpu_time_limit ?? 5,
    memory_limit: (params.memory_limit ?? 128) * 1024,
  };

  const res = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=false`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Judge0 submit failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.token;
}

export async function getSubmissionResult(token: string): Promise<Judge0Result> {
  const res = await fetch(
    `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=true&fields=status,stdout,stderr,compile_output,time,memory`,
    { headers: getHeaders() }
  );

  if (!res.ok) throw new Error(`Judge0 get failed: ${res.status}`);

  const data = await res.json();
  return {
    status: data.status,
    stdout: data.stdout ? Buffer.from(data.stdout, 'base64').toString('utf8') : null,
    stderr: data.stderr ? Buffer.from(data.stderr, 'base64').toString('utf8') : null,
    compile_output: data.compile_output ? Buffer.from(data.compile_output, 'base64').toString('utf8') : null,
    time: data.time,
    memory: data.memory,
  };
}

export async function submitAndWait(params: SubmitParams, maxWaitMs = 15000): Promise<Judge0Result> {
  const token = await submitCode(params);
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const result = await getSubmissionResult(token);
    if (result.status.id >= 3) return result;
    await new Promise(r => setTimeout(r, 1000));
  }

  return {
    status: { id: 13, description: 'Internal Error - Timeout' },
    stdout: null, stderr: null, compile_output: null, time: null, memory: null,
  };
}
