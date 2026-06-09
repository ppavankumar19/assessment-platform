export const LANGUAGES = [
  { id: 50, name: 'C (GCC 9.2)', extension: '.c', monacoLang: 'c' },
  { id: 54, name: 'C++ (GCC 9.2)', extension: '.cpp', monacoLang: 'cpp' },
  { id: 71, name: 'Python 3 (3.8)', extension: '.py', monacoLang: 'python' },
  { id: 63, name: 'JavaScript (Node 12)', extension: '.js', monacoLang: 'javascript' },
  { id: 62, name: 'Java (OpenJDK 13)', extension: '.java', monacoLang: 'java' },
  { id: 60, name: 'Go (1.13.5)', extension: '.go', monacoLang: 'go' },
] as const;

export function getLanguageById(id: number) {
  return LANGUAGES.find(l => l.id === id);
}

export function getLanguageName(id: number): string {
  return getLanguageById(id)?.name ?? `Language ${id}`;
}

export function getMonacoLanguage(id: number): string {
  return getLanguageById(id)?.monacoLang ?? 'plaintext';
}
