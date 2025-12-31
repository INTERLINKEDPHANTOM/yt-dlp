import React from 'react';

interface ProgressBarProps {
    percent: number;
    status: string;
}

export default function ProgressBar({ percent, status }: ProgressBarProps) {
    return (
        <div className="progress-section">
            <div className="progress-info">
                <span>{status}</span>
                <span>{Math.round(percent)}%</span>
            </div>
            <div className="progress-bar-bg">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${percent}%` }}
                ></div>
            </div>
        </div>
    );
}
