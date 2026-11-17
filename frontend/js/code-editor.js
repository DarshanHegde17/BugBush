/**
 * BugBash Code Editor Wrapper
 * Integrates Monaco Editor with fallback textarea support, syntax highlighting,
 * auto-indentation, and dynamic dark/light theme switching.
 */
class BugBashCodeEditor {
    constructor() {
        this.editor = null;
        this.isMonaco = false;
        this.currentLanguage = 'Python';
        this.currentTheme = 'vs-dark';
        this.changeListeners = [];
        this.fallbackTextarea = null;
        this.fallbackLineNumbers = null;
    }

    /**
     * Maps user-selected language to Monaco language identifier.
     */
    mapMonacoLanguage(lang) {
        const l = (lang || '').toLowerCase();
        if (l.includes('python')) return 'python';
        if (l.includes('javascript') || l.includes('js')) return 'javascript';
        if (l.includes('c++') || l.includes('cpp')) return 'cpp';
        if (l === 'c') return 'c';
        if (l.includes('java')) return 'java';
        return 'python';
    }

    /**
     * Initializes Monaco Editor or seamlessly falls back to enhanced textarea.
     */
    async init(mountElementId, options = {}) {
        const mountEl = document.getElementById(mountElementId);
        this.fallbackTextarea = document.getElementById('fallbackEditorTextarea');
        this.fallbackLineNumbers = document.getElementById('fallbackLineNumbers');
        const fallbackContainer = document.getElementById('fallbackEditorContainer');

        const initialCode = options.initialCode || '# Write your code here\n';
        this.currentLanguage = options.language || 'Python';
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        this.currentTheme = isDark ? 'vs-dark' : 'vs';

        // Check if Monaco AMD loader exists
        if (typeof window.require !== 'undefined') {
            try {
                await this._loadMonacoAMD();
                if (window.monaco && mountEl) {
                    this.editor = window.monaco.editor.create(mountEl, {
                        value: initialCode,
                        language: this.mapMonacoLanguage(this.currentLanguage),
                        theme: this.currentTheme,
                        automaticLayout: true,
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        lineNumbers: 'on',
                        roundedSelection: true,
                        tabSize: 4,
                        renderWhitespace: 'none',
                        cursorBlinking: 'smooth',
                        bracketPairColorization: { enabled: true }
                    });

                    this.isMonaco = true;
                    this.editor.onDidChangeModelContent(() => {
                        const val = this.editor.getValue();
                        this._triggerChange(val);
                    });

                    console.log('BugBash Monaco Editor initialized successfully.');
                    return;
                }
            } catch (err) {
                console.warn('Monaco Editor CDN load skipped or timed out. Falling back to native code editor.', err);
            }
        }

        // Fallback Native Editor
        if (mountEl) mountEl.style.display = 'none';
        if (fallbackContainer) fallbackContainer.style.display = 'flex';
        this._initFallbackEditor(initialCode);
    }

    _loadMonacoAMD() {
        return new Promise((resolve, reject) => {
            if (window.monaco) return resolve();
            if (typeof window.require === 'undefined') return reject('RequireJS missing');

            const timeoutId = setTimeout(() => reject('Monaco CDN timeout'), 3500);

            window.require.config({
                paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }
            });

            window.require(['vs/editor/editor.main'], () => {
                clearTimeout(timeoutId);
                resolve();
            }, (err) => {
                clearTimeout(timeoutId);
                reject(err);
            });
        });
    }

    _initFallbackEditor(initialCode) {
        if (!this.fallbackTextarea) return;
        this.fallbackTextarea.value = initialCode;
        this._updateFallbackGutter();

        this.fallbackTextarea.addEventListener('input', () => {
            this._updateFallbackGutter();
            this._triggerChange(this.fallbackTextarea.value);
        });

        // Enable Tab Indentation in textarea
        this.fallbackTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.fallbackTextarea.selectionStart;
                const end = this.fallbackTextarea.selectionEnd;
                this.fallbackTextarea.value = this.fallbackTextarea.value.substring(0, start) + '    ' + this.fallbackTextarea.value.substring(end);
                this.fallbackTextarea.selectionStart = this.fallbackTextarea.selectionEnd = start + 4;
                this._updateFallbackGutter();
                this._triggerChange(this.fallbackTextarea.value);
            }
        });
    }

    _updateFallbackGutter() {
        if (!this.fallbackTextarea || !this.fallbackLineNumbers) return;
        const lineCount = this.fallbackTextarea.value.split('\n').length;
        let numbers = '';
        for (let i = 1; i <= Math.max(1, lineCount); i++) {
            numbers += i + '\n';
        }
        this.fallbackLineNumbers.textContent = numbers;
    }

    getValue() {
        if (this.isMonaco && this.editor) {
            return this.editor.getValue();
        }
        return this.fallbackTextarea ? this.fallbackTextarea.value : '';
    }

    setValue(code) {
        const val = code || '';
        if (this.isMonaco && this.editor) {
            if (this.editor.getValue() !== val) {
                this.editor.setValue(val);
            }
        } else if (this.fallbackTextarea) {
            this.fallbackTextarea.value = val;
            this._updateFallbackGutter();
        }
    }

    setLanguage(lang) {
        this.currentLanguage = lang;
        if (this.isMonaco && this.editor && window.monaco) {
            const monacoLang = this.mapMonacoLanguage(lang);
            const model = this.editor.getModel();
            if (model) {
                window.monaco.editor.setModelLanguage(model, monacoLang);
            }
        }
    }

    setTheme(isDark) {
        this.currentTheme = isDark ? 'vs-dark' : 'vs';
        if (this.isMonaco && window.monaco) {
            window.monaco.editor.setTheme(this.currentTheme);
        }
    }

    onDidChangeContent(callback) {
        if (typeof callback === 'function') {
            this.changeListeners.push(callback);
        }
    }

    _triggerChange(val) {
        this.changeListeners.forEach(cb => {
            try { cb(val); } catch (e) { console.error('Editor change listener error:', e); }
        });
    }

    focus() {
        if (this.isMonaco && this.editor) {
            this.editor.focus();
        } else if (this.fallbackTextarea) {
            this.fallbackTextarea.focus();
        }
    }
}

// Global editor instance
window.bugbashEditor = new BugBashCodeEditor();
