const { createHash, webcrypto } = require('crypto');
const technoline = require('./technoline');

// msedge-tts assumes the Web Crypto API is a global (stable without a flag
// only from Node 19+). Railway currently runs Node 18, where `crypto` is
// not global by default — polyfill it from Node's own crypto module rather
// than bump the whole app's Node version for one dependency.
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

/**
 * Speech we make ourselves.
 *
 * Technoline's own built-in TTS does not reliably synthesize new text on
 * this line (confirmed empirically, not just suspected) — what plays is a
 * file. So every fixed prompt is synthesized here with a free, keyless TTS
 * engine (Microsoft Edge's), cached by a hash of its text+voice, and
 * uploaded once to a dedicated Technoline extension. Call-time code then
 * references it by fileName instead of text.
 */

const VOICE = process.env.SPEECH_VOICE || 'he-IL-AvriNeural';
const PREFIX = 'satmer';

function clipName(text, voice = VOICE) {
  const digest = createHash('sha256').update(`${voice} ${text}`).digest('hex').slice(0, 16);
  return `${PREFIX}_${digest}`;
}

async function synthesize(text, voice = VOICE) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const { audioStream } = tts.toStream(text);
  const chunks = [];
  for await (const chunk of audioStream) chunks.push(Buffer.from(chunk));

  const audio = Buffer.concat(chunks);
  if (audio.length === 0) throw new Error('TTS synthesiser returned no audio');
  return audio;
}

class SpeechCatalog {
  constructor() {
    this.extensionId = process.env.TECHNOLINE_AUDIO_EXTENSION;
    this.ready = new Set();
  }

  isReady(text) {
    return this.ready.has(clipName(text));
  }

  fileNameFor(text) {
    return clipName(text);
  }

  /** Names already uploaded to the audio extension, so a restart doesn't re-upload. */
  async adopt() {
    if (!this.extensionId) return 0;
    try {
      const files = await technoline.filesList(this.extensionId);
      const names = Array.isArray(files) ? files : [];
      for (const file of names) {
        if (file.name) this.ready.add(file.name.replace(/\.[a-z0-9]+$/i, ''));
      }
      return this.ready.size;
    } catch (error) {
      console.error('Speech catalog adopt() failed:', error.message);
      return 0;
    }
  }

  /** Synthesizes and uploads one phrase unless already known to be ready. Never throws. */
  async ensure(text) {
    const name = clipName(text);
    if (this.ready.has(name)) return true;
    if (!this.extensionId) {
      console.warn('TECHNOLINE_AUDIO_EXTENSION not set — cannot upload speech clips');
      return false;
    }

    try {
      const audio = await synthesize(text);
      await technoline.uploadFile(this.extensionId, audio, `${name}.mp3`, { name, checkDuplicate: 'BACKUP' });
      this.ready.add(name);
      return true;
    } catch (error) {
      console.error(`Failed to prepare speech clip for "${text.slice(0, 40)}...":`, error.message);
      return false;
    }
  }

  /** Synthesizes+uploads every phrase in the catalog. Run once at startup. */
  async warm(phrases) {
    await this.adopt();
    let ready = 0;
    let failed = 0;
    for (const text of Object.values(phrases)) {
      if (await this.ensure(text)) ready += 1;
      else failed += 1;
    }
    return { ready, failed };
  }

  // ---- admin-recorded overrides for named PHRASES entries ----
  //
  // Lets an admin replace any fixed prompt's synthesized voice with her own
  // recording, uploaded under a fixed name keyed to the phrase — so call
  // code can keep asking "is there an override for `activityUpdatedPrefix`"
  // without knowing whether the answer today is a human recording or TTS.

  overrideName(phraseKey) {
    return `override_${phraseKey}`;
  }

  hasOverride(phraseKey) {
    return this.ready.has(this.overrideName(phraseKey));
  }

  /** Uploads an admin recording as the override for `phraseKey`. */
  async setOverride(phraseKey, audioBuffer, originalFileName) {
    if (!this.extensionId) throw new Error('TECHNOLINE_AUDIO_EXTENSION not configured');
    const name = this.overrideName(phraseKey);
    await technoline.uploadFile(this.extensionId, audioBuffer, originalFileName, { name, checkDuplicate: 'BACKUP' });
    this.ready.add(name);
  }

  /** Removes the override for `phraseKey`, so playback falls back to TTS. */
  async clearOverride(phraseKey) {
    if (!this.extensionId) return;
    const name = this.overrideName(phraseKey);
    const files = await technoline.filesList(this.extensionId);
    const match = (Array.isArray(files) ? files : []).find(f => f.name === name);
    if (match) await technoline.fileDelete(match.id, this.extensionId);
    this.ready.delete(name);
  }
}

module.exports = { SpeechCatalog, clipName, speechCatalog: new SpeechCatalog() };
