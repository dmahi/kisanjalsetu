import { useState } from 'react';
import { useLocale } from '../store/locale.store';

interface VoiceSpeakerButtonProps {
  /** The text string to be read aloud to the farmer */
  textToSpeak: string;
  /** Optional custom button label override */
  label?: string;
}

export function VoiceSpeakerButton({ textToSpeak, label }: VoiceSpeakerButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const locale = useLocale((s) => s.locale);
  const t = useLocale((s) => s.t);

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert(textToSpeak);
      return;
    }

    const synth = window.speechSynthesis;
    if (synth.speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.9; // Slightly slower speed for easy farmer comprehension
    utterance.pitch = 1.0;

    // Set voice language code based on current locale
    if (locale === 'hi') {
      utterance.lang = 'hi-IN';
    } else if (locale === 'pa') {
      utterance.lang = 'pa-IN';
    } else {
      utterance.lang = 'en-IN';
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    synth.speak(utterance);
  };

  return (
    <button
      type="button"
      className={`voice-speaker-btn ${speaking ? 'speaking' : ''}`}
      onClick={handleSpeak}
      title="Tap to listen audio readout"
    >
      <span>{speaking ? '🔊 🗣️' : '🔊'}</span>
      <span>{label || t('listen')}</span>
    </button>
  );
}
