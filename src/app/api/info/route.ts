import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// Path to the yt-dlp binary (Env var or default to system command)
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ message: 'URL is required' }, { status: 400 });
        }

        // Spawn yt-dlp process
        // -j: JSON output
        // --no-warnings: cleaner output
        const ytDlpProcess = spawn(YT_DLP_PATH, ['-j', '--no-warnings', url]);

        let outputData = '';
        let errorData = '';

        ytDlpProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        ytDlpProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        const exitCode = await new Promise<number>((resolve) => {
            ytDlpProcess.on('close', (code) => resolve(code ?? 1));
        });

        if (exitCode !== 0) {
            console.error('yt-dlp error:', errorData);
            return NextResponse.json({ message: 'Failed to fetch video info', detail: errorData }, { status: 400 });
        }

        const info = JSON.parse(outputData);
        const formatsRaw = info.formats || [];

        // --- Format Filtering Logic (Ported from Python) ---
        const audioBuckets: Record<number, any> = { 128: null, 256: null, 320: null };
        const videoBuckets: Record<number, any> = {
            144: null, 240: null, 360: null, 480: null,
            720: null, 1080: null, 1440: null, 2160: null
        };

        for (const f of formatsRaw) {
            if (!f.protocol || f.protocol.includes('m3u8')) continue;

            // Audio Only
            if (f.vcodec === 'none' && f.acodec !== 'none') {
                const abr = f.abr || 0;
                if (!abr) continue;
                if (abr <= 160) {
                    if (!audioBuckets[128] || f.abr > audioBuckets[128].abr) audioBuckets[128] = f;
                } else if (abr <= 280) {
                    if (!audioBuckets[256] || f.abr > audioBuckets[256].abr) audioBuckets[256] = f;
                } else {
                    if (!audioBuckets[320] || f.abr > audioBuckets[320].abr) audioBuckets[320] = f;
                }
            }

            // Video Processing
            const height = f.height;
            if (height) {
                let closestH: string | null = null;
                let minDiff = Infinity;

                // Find closest bucket
                for (const keyHStr of Object.keys(videoBuckets)) {
                    const keyH = parseInt(keyHStr);
                    const diff = Math.abs(height - keyH);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestH = keyHStr;
                    }
                }

                if (closestH && minDiff < 150) {
                    const closestHNum = parseInt(closestH);
                    const current = videoBuckets[closestHNum];
                    const hasAudio = f.acodec !== 'none';
                    const currHasAudio = current ? current.acodec !== 'none' : false;

                    if (!current) {
                        videoBuckets[closestHNum] = f;
                    } else {
                        if (hasAudio && !currHasAudio) {
                            videoBuckets[closestHNum] = f;
                        } else if (hasAudio === currHasAudio) {
                            if ((f.tbr || 0) > (current.tbr || 0)) {
                                videoBuckets[closestHNum] = f;
                            }
                        }
                    }
                }
            }
        }

        // --- Formats Sanitization ---
        const sanitizedFormats: any[] = [];

        // Video Formats (Bucketed)
        for (const h of [144, 240, 360, 480, 720, 1080, 1440, 2160]) {
            const f = videoBuckets[h];
            if (f) {
                sanitizedFormats.push({
                    format_id: f.format_id,
                    ext: f.ext,
                    resolution: `${h}p`,
                    filesize: f.filesize,
                    note: f.acodec !== 'none' ? "Video + Audio" : "Video Only"
                });
            }
        }

        // Audio Formats (Bucketed)
        const labels: Record<number, string> = { 128: "128kbps (Low)", 256: "256kbps (Medium)", 320: "320kbps (High)" };
        for (const br of [128, 256, 320]) {
            const f = audioBuckets[br];
            if (f) {
                sanitizedFormats.push({
                    format_id: f.format_id,
                    ext: f.ext,
                    resolution: "Audio",
                    filesize: f.filesize,
                    note: labels[br]
                });
            }
        }

        return NextResponse.json({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
            uploader: info.uploader,
            formats: sanitizedFormats
        });
    } catch (error: any) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
