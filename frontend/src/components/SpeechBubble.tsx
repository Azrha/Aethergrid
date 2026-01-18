import { useState, useEffect } from 'react';

interface Thought {
    entity_id: number;
    text: string;
    is_speech: boolean;
    duration_ms: number;
}

interface SpeechBubbleProps {
    thought: Thought;
    entityPosition?: { x: number; y: number };
    onExpire: (entityId: number) => void;
}

/**
 * SpeechBubble - A pixel-art styled speech/thought bubble for entity dialogue
 */
export function SpeechBubble({ thought, entityPosition, onExpire }: SpeechBubbleProps) {
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        // Fade in
        setTimeout(() => setOpacity(1), 50);

        // Fade out and expire
        const timeout = setTimeout(() => {
            setOpacity(0);
            setTimeout(() => onExpire(thought.entity_id), 300);
        }, thought.duration_ms);

        return () => clearTimeout(timeout);
    }, [thought, onExpire]);

    const bubbleStyle: React.CSSProperties = {
        position: 'absolute',
        left: entityPosition?.x ?? 100,
        top: entityPosition?.y ?? 100,
        transform: 'translate(-50%, -100%)',
        opacity,
        transition: 'opacity 0.3s ease-in-out',
        pointerEvents: 'none',
        zIndex: 1000,
    };

    const bubbleClass = thought.is_speech ? 'speech-bubble' : 'thought-bubble';

    return (
        <div style={bubbleStyle} className={`pixel-bubble ${bubbleClass}`}>
            <div className="bubble-content">
                {thought.text}
            </div>
            <div className="bubble-tail" />
        </div>
    );
}

interface EntityThoughtsProps {
    thoughts: Thought[];
    entityPositions: Map<number, { x: number; y: number }>;
    onThoughtExpire: (entityId: number) => void;
}

/**
 * EntityThoughts - Container for all active entity speech/thought bubbles
 */
export function EntityThoughts({ thoughts, entityPositions, onThoughtExpire }: EntityThoughtsProps) {
    return (
        <div className="entity-thoughts-container">
            {thoughts.map((thought) => (
                <SpeechBubble
                    key={`${thought.entity_id}-${thought.text}`}
                    thought={thought}
                    entityPosition={entityPositions.get(thought.entity_id)}
                    onExpire={onThoughtExpire}
                />
            ))}
        </div>
    );
}

// CSS styles to be added to index.css or a separate component stylesheet
export const speechBubbleStyles = `
.pixel-bubble {
  font-family: 'Press Start 2P', 'Courier New', monospace;
  font-size: 8px;
  line-height: 1.4;
  background: #ffffff;
  border: 2px solid #333;
  border-radius: 8px;
  padding: 6px 10px;
  max-width: 120px;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.3);
  image-rendering: pixelated;
}

.speech-bubble {
  background: linear-gradient(135deg, #fff 0%, #f0f0f0 100%);
}

.speech-bubble .bubble-tail {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid #333;
}

.speech-bubble .bubble-tail::after {
  content: '';
  position: absolute;
  top: -10px;
  left: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid #fff;
}

.thought-bubble {
  background: linear-gradient(135deg, #e8e0ff 0%, #d8d0f0 100%);
  border-color: #8877aa;
}

.thought-bubble .bubble-tail {
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
}

.thought-bubble .bubble-tail::before,
.thought-bubble .bubble-tail::after {
  content: '';
  position: absolute;
  background: #8877aa;
  border-radius: 50%;
}

.thought-bubble .bubble-tail::before {
  width: 6px;
  height: 6px;
  bottom: 4px;
  left: -3px;
}

.thought-bubble .bubble-tail::after {
  width: 4px;
  height: 4px;
  bottom: -2px;
  left: -2px;
}

.bubble-content {
  color: #333;
  text-shadow: none;
  word-wrap: break-word;
}

.entity-thoughts-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}
`;

export default EntityThoughts;
