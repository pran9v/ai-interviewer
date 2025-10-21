import React, { useEffect, useState } from 'react';
import { VoiceTestUtils } from '../utils/voice-test-utils';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TestResult {
    microphone: boolean;
    speaker: boolean;
    twilioDevice: boolean;
    network: boolean;
}

export default function VoiceTest() {
    const [testing, setTesting] = useState(false);
    const [results, setResults] = useState<TestResult | null>(null);
    const [currentTest, setCurrentTest] = useState<string>('');

    const runTests = async () => {
        setTesting(true);
        setResults(null);
        
        try {
            const voiceTest = VoiceTestUtils.getInstance();
            
            // Test microphone
            setCurrentTest('microphone');
            const micResult = await voiceTest.testMicrophone();
            setResults(prev => ({ ...prev, microphone: micResult }));
            
            // Test speaker
            setCurrentTest('speaker');
            const speakerResult = await voiceTest.testSpeaker();
            setResults(prev => ({ ...prev, speaker: speakerResult }));
            
            // Test Twilio Device
            setCurrentTest('twilioDevice');
            const deviceResult = await voiceTest.testTwilioDevice();
            setResults(prev => ({ ...prev, twilioDevice: deviceResult }));
            
            // Test network
            setCurrentTest('network');
            const networkResult = await voiceTest.testNetwork();
            setResults(prev => ({ ...prev, network: networkResult }));
            
            // Clean up
            voiceTest.cleanup();
            
            // Show overall result
            const allPassed = Object.values({ micResult, speakerResult, deviceResult, networkResult })
                .every(result => result);
            
            if (allPassed) {
                toast.success('All voice tests passed successfully!');
            } else {
                toast.error('Some voice tests failed. Please check the results.');
            }
            
        } catch (error) {
            console.error('Voice test error:', error);
            toast.error('Error running voice tests');
        } finally {
            setTesting(false);
            setCurrentTest('');
        }
    };

    const getStatusIcon = (passed: boolean | undefined) => {
        if (passed === undefined) return null;
        return passed ? (
            <Check className="text-green-500" />
        ) : (
            <X className="text-red-500" />
        );
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">Voice System Test</h2>
            
            <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                    <span>Microphone</span>
                    {currentTest === 'microphone' ? (
                        <Loader2 className="animate-spin text-blue-500" />
                    ) : (
                        getStatusIcon(results?.microphone)
                    )}
                </div>
                
                <div className="flex items-center justify-between">
                    <span>Speaker</span>
                    {currentTest === 'speaker' ? (
                        <Loader2 className="animate-spin text-blue-500" />
                    ) : (
                        getStatusIcon(results?.speaker)
                    )}
                </div>
                
                <div className="flex items-center justify-between">
                    <span>Twilio Device</span>
                    {currentTest === 'twilioDevice' ? (
                        <Loader2 className="animate-spin text-blue-500" />
                    ) : (
                        getStatusIcon(results?.twilioDevice)
                    )}
                </div>
                
                <div className="flex items-center justify-between">
                    <span>Network Connection</span>
                    {currentTest === 'network' ? (
                        <Loader2 className="animate-spin text-blue-500" />
                    ) : (
                        getStatusIcon(results?.network)
                    )}
                </div>
            </div>
            
            <Button
                onClick={runTests}
                disabled={testing}
                className="w-full"
            >
                {testing ? (
                    <>
                        <Loader2 className="animate-spin mr-2" />
                        Testing...
                    </>
                ) : (
                    'Run Voice Tests'
                )}
            </Button>
            
            {results && !testing && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <h3 className="font-semibold mb-2">Test Results</h3>
                    <ul className="space-y-2">
                        {Object.entries(results).map(([test, passed]) => (
                            <li key={test} className={`flex items-center ${passed ? 'text-green-600' : 'text-red-600'}`}>
                                {passed ? <Check className="mr-2" /> : <X className="mr-2" />}
                                {test.charAt(0).toUpperCase() + test.slice(1)}: {passed ? 'Passed' : 'Failed'}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
