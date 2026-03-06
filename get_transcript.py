from youtube_transcript_api import YouTubeTranscriptApi
import sys

try:
    transcript = YouTubeTranscriptApi.get_transcript('WzqWL-NQcIk', languages=['es'])
    with open('transcript.txt', 'w', encoding='utf-8') as f:
        f.write(' '.join([x['text'] for x in transcript]))
    print("Transcript saved.")
except Exception as e:
    print(f"Error: {e}")
