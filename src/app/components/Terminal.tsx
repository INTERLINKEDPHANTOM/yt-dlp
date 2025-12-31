import React, { useEffect, useRef } from 'react';

interface TerminalProps {
    logs: string[];
}

export default function Terminal({ logs }: TerminalProps) {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="terminal-window">
            <div className="terminal-logs">
                {logs.length === 0 && <span className="log-line">Waiting for task...</span>}
                {logs.map((log, i) => (
                    <span key={i} className={`log-line ${log.includes('error') ? 'error' : ''}`}>
                        {log.startsWith('[') ? log : `> ${log}`}
                    </span>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
}
