import { VOICE_CONFIG } from '../config/voice-config';

export enum VoiceErrorType {
    DEVICE_SETUP = 'DEVICE_SETUP',
    MICROPHONE_ACCESS = 'MICROPHONE_ACCESS',
    NETWORK = 'NETWORK',
    TWILIO = 'TWILIO',
    AUDIO = 'AUDIO',
    UNKNOWN = 'UNKNOWN'
}

export interface VoiceError {
    type: VoiceErrorType;
    message: string;
    details?: any;
    timestamp: Date;
}

export class VoiceErrorHandler {
    private static instance: VoiceErrorHandler;
    private errors: VoiceError[] = [];
    private errorCallbacks: ((error: VoiceError) => void)[] = [];

    private constructor() {}

    public static getInstance(): VoiceErrorHandler {
        if (!VoiceErrorHandler.instance) {
            VoiceErrorHandler.instance = new VoiceErrorHandler();
        }
        return VoiceErrorHandler.instance;
    }

    /**
     * Handle a voice-related error
     */
    public handleError(type: VoiceErrorType, message: string, details?: any): void {
        const error: VoiceError = {
            type,
            message,
            details,
            timestamp: new Date()
        };

        // Log error if in debug mode
        if (VOICE_CONFIG.debug.logLevel === 'debug') {
            console.error('Voice Error:', {
                type: error.type,
                message: error.message,
                details: error.details,
                timestamp: error.timestamp
            });
        }

        // Store error
        this.errors.push(error);

        // Notify callbacks
        this.errorCallbacks.forEach(callback => callback(error));

        // Handle specific error types
        switch (type) {
            case VoiceErrorType.MICROPHONE_ACCESS:
                this.handleMicrophoneError(error);
                break;
            case VoiceErrorType.NETWORK:
                this.handleNetworkError(error);
                break;
            case VoiceErrorType.TWILIO:
                this.handleTwilioError(error);
                break;
            case VoiceErrorType.AUDIO:
                this.handleAudioError(error);
                break;
            default:
                this.handleUnknownError(error);
        }
    }

    /**
     * Subscribe to error notifications
     */
    public onError(callback: (error: VoiceError) => void): () => void {
        this.errorCallbacks.push(callback);
        return () => {
            this.errorCallbacks = this.errorCallbacks.filter(cb => cb !== callback);
        };
    }

    /**
     * Get all errors
     */
    public getErrors(): VoiceError[] {
        return [...this.errors];
    }

    /**
     * Clear error history
     */
    public clearErrors(): void {
        this.errors = [];
    }

    /**
     * Handle microphone access errors
     */
    private handleMicrophoneError(error: VoiceError): void {
        // Implement specific microphone error handling
        if (error.details?.name === 'NotAllowedError') {
            // Handle permission denied
            this.showErrorMessage('Microphone access was denied. Please grant microphone permissions to use the voice interview feature.');
        } else if (error.details?.name === 'NotFoundError') {
            // Handle no microphone available
            this.showErrorMessage('No microphone found. Please connect a microphone and try again.');
        }
    }

    /**
     * Handle network-related errors
     */
    private handleNetworkError(error: VoiceError): void {
        // Implement specific network error handling
        if (error.details?.type === 'timeout') {
            this.showErrorMessage('Network connection timed out. Please check your internet connection.');
        } else {
            this.showErrorMessage('Network error occurred. Please check your internet connection and try again.');
        }
    }

    /**
     * Handle Twilio-specific errors
     */
    private handleTwilioError(error: VoiceError): void {
        // Implement specific Twilio error handling
        if (error.details?.code === 31205) {
            // Handle invalid token
            this.showErrorMessage('Session expired. Please refresh the page and try again.');
        } else {
            this.showErrorMessage('An error occurred with the voice service. Please try again later.');
        }
    }

    /**
     * Handle audio-related errors
     */
    private handleAudioError(error: VoiceError): void {
        // Implement specific audio error handling
        if (error.details?.name === 'NotSupportedError') {
            this.showErrorMessage('Audio format not supported. Please use a modern browser.');
        } else {
            this.showErrorMessage('Audio error occurred. Please check your audio settings and try again.');
        }
    }

    /**
     * Handle unknown errors
     */
    private handleUnknownError(error: VoiceError): void {
        this.showErrorMessage('An unexpected error occurred. Please try again.');
    }

    /**
     * Show error message to user
     */
    private showErrorMessage(message: string): void {
        // You can customize this to use your preferred notification system
        if (typeof window !== 'undefined') {
            // Use toast notification if available
            if (window.toast) {
                window.toast.error(message);
            } else {
                alert(message);
            }
        }
    }

    /**
     * Get error recovery suggestions
     */
    public getRecoverySuggestions(error: VoiceError): string[] {
        switch (error.type) {
            case VoiceErrorType.MICROPHONE_ACCESS:
                return [
                    'Check browser microphone permissions',
                    'Ensure microphone is properly connected',
                    'Try using a different microphone',
                    'Restart your browser'
                ];
            case VoiceErrorType.NETWORK:
                return [
                    'Check your internet connection',
                    'Try connecting to a different network',
                    'Move closer to your WiFi router',
                    'Disable VPN if enabled'
                ];
            case VoiceErrorType.TWILIO:
                return [
                    'Refresh the page',
                    'Clear browser cache',
                    'Try again in a few minutes',
                    'Contact support if the issue persists'
                ];
            case VoiceErrorType.AUDIO:
                return [
                    'Check audio settings in your OS',
                    'Update your browser',
                    'Try using a different browser',
                    'Restart your computer'
                ];
            default:
                return [
                    'Refresh the page',
                    'Try again later',
                    'Contact support if the issue persists'
                ];
        }
    }
}
