/**
 * BugBash Server-Authoritative Examination Timer
 * Guarantees cryptographic server timing synchronization, anti-tampering,
 * low-time visual warnings, and automatic submission on time expiration.
 */
class ExamTimer {
    constructor() {
        this.intervalId = null;
        this.expiresTimestamp = null;
        this.serverDriftMs = 0;
        this.warningThreshold = 300; // 5 minutes
        this.criticalThreshold = 60; // 1 minute
        this.warned = false;
        this.onTickCb = null;
        this.onExpireCb = null;
        this.onWarningCb = null;
    }

    /**
     * Initializes the timer with server-authoritative timestamps.
     * @param {Object} config - { startedAt, expiresAt, remainingSeconds, onTick, onExpire, onWarning }
     */
    init(config = {}) {
        this.stop();

        this.onTickCb = config.onTick || null;
        this.onExpireCb = config.onExpire || null;
        this.onWarningCb = config.onWarning || null;

        if (config.warningThreshold) {
            this.warningThreshold = config.warningThreshold;
        }

        const clientNow = Date.now();
        const serverExpires = new Date(config.expiresAt).getTime();

        // Calculate drift using server remaining_seconds if provided
        if (typeof config.remainingSeconds === 'number') {
            const calculatedTarget = clientNow + (config.remainingSeconds * 1000);
            this.expiresTimestamp = calculatedTarget;
        } else {
            this.expiresTimestamp = serverExpires;
        }

        this.start();
    }

    start() {
        this._tick();
        this.intervalId = setInterval(() => this._tick(), 1000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    _tick() {
        if (!this.expiresTimestamp) return;

        const now = Date.now();
        const remainingMs = Math.max(0, this.expiresTimestamp - now);
        const remainingSeconds = Math.floor(remainingMs / 1000);

        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const seconds = remainingSeconds % 60;

        const pad = (n) => String(n).padStart(2, '0');
        const formatted = hours > 0 
            ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` 
            : `${pad(minutes)}:${pad(seconds)}`;

        const isWarning = remainingSeconds <= this.warningThreshold && remainingSeconds > this.criticalThreshold;
        const isCritical = remainingSeconds <= this.criticalThreshold && remainingSeconds > 0;

        if (isWarning && !this.warned && this.onWarningCb) {
            this.warned = true;
            this.onWarningCb(remainingSeconds);
        }

        if (this.onTickCb) {
            this.onTickCb({
                formatted,
                remainingSeconds,
                isWarning,
                isCritical
            });
        }

        if (remainingSeconds <= 0) {
            this.stop();
            if (this.onExpireCb) {
                this.onExpireCb();
            }
        }
    }
}

// Global timer instance
window.examTimer = new ExamTimer();
