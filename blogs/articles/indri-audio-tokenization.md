# Audio Tokenization: Lessons from Building Indri

19 November 2024 · Indri team research

Written with [Romit Jain](https://www.linkedin.com/in/r0m1t/) and <b>Apurva Gupta</b> as part of the Indri team’s audio-modeling work.

Transformers, which have demonstrated remarkable success in modeling text, offer promising possibilities for audio modeling as well. However, audio modeling presents its own unique challenges. To leverage transformer architectures for audio, we need to bridge the gap between continuous audio signals and the discrete tokens that transformers typically process. Audio tokenization provides this bridge, enabling us to apply transformer-based language modeling approaches to audio modeling.

This post covers:

1. Why audio tokenization matters
2. Hierarchical and single-model approaches to audio
3. Lessons from building our own tokenizer

## Need for audio tokenization

The first step in audio modeling is to enable a transformer-based model to accept audio signals as input. There are various ways audio can be used as input to transformers. For example, in [Whisper](https://github.com/openai/whisper?tab=readme-ov-file#approach), the audio signal is first converted to a log mel spectrogram image, and then an embedding of that image is used as an input to the model. An embedding of the audio generated from an audio encoder (for example, embeddings of the last layer of the encoder of Whisper) can also be used as input to a transformer model. This is a popular technique that is already being used in a lot of multimodal LLMs. For example, [Llama-Omni](https://github.com/ictnlp/LLaMA-Omni) trains a projector layer on the embeddings retrieved from the Whisper encoder.

This approach has a significant downside. The embeddings only contain the information that was used in the training of the embedding model. For example, since Whisper is trained to transcribe audio, Whisper embeddings will not contain enough information about nonspeech audio, or the emotion of the speaker. However, tokenizing audio preserves a lot of the information about the audio.

Imagine if there was a better way to process audio that could enable transformer models to both accept audio as input as well as generate audio directly. Tokenization converts a continuous audio signal into discrete tokens that can be used as input to a transformer model in the same way text tokens are used. Since now, audio is also a token, auto-regressive transformers can also generate audio tokens which can be decoded into audio signals.

Hopefully, this provides enough motivation to think of audio in terms of tokens rather than embeddings.


## Different ways to tokenize audio

Audio tokenization is not as straightforward as text tokenization due to various reasons.

1. For text, token boundary can be learned from data but since audio is an analog and continuous signal, it is not possible to cut the sequence randomly and convert it into tokens.
2. Audio has a lot of variety. Even the same content can be spoken differently by different people (and even the same person). This presents the challenge of tokenizing a word being spoken by one person versus the same word being spoken by another person.
3. Finally, audio is a very sparse modality compared to text. For audio, it takes 16,000 floating point numbers for a 16kHz signal to represent 1 second worth of data. Whereas, text can represent that in as low as 5 words.

To tackle all the above issues, audio is tokenized using neural networks. These neural networks learn the representation of audio in some latent space which is further discretized to convert them into tokens. Two types of tokens are used for audio:

1. **Acoustic tokens**: Acoustic tokens are created with the intent of audio compression. They preserve speaker traits, prosodic features, and phonetic information from the audio. This tokenization method will preserve the information about the individual's voice as well. Some of the models to tokenize audio into acoustic tokens are [SoundStream by Google](https://research.google/pubs/soundstream-an-end-to-end-neural-audio-codec/) or [Encodec by Facebook](https://audiocraft.metademolab.com/encodec.html). Acoustic tokens use a system of codebooks, where each codebook captures different aspects of the audio signal. The number of codebooks directly affects the quality of audio representation - more codebooks means more detailed audio preservation but requires more tokens. For instance, in Encodec, using more codebooks can increase the token count from 75 to 300 tokens per second, with each additional codebook (an increment of 75 tokens per codebook) improving the audio reconstruction quality. When using number of codebooks for tokens, there's a direct trade-off between audio quality and model requirements. Higher numbers of codebooks provide better audio quality but generate longer token sequences demanding more computational resources and memory.


2. **Semantic tokens**: While acoustic tokens excel at preserving the audio signal's physical characteristics, they don't specifically capture the linguistic structure of speech. This is where semantic tokens come into play. Semantic tokens are created to preserve how the words are read and the linguistic information of the audio. They complement acoustic tokens by focusing on the language content rather than the exact sound reproduction. Some of the famous semantic tokenizers are [HuBert](https://arxiv.org/abs/2106.07447) and [Wav2Vec BERT](https://arxiv.org/abs/2108.06209). These tokenizers convert an audio signal into semantic audio tokens. For example, HuBert represents a single second of audio in 50 tokens. These tokenizers can't reconstruct the audio directly.

A natural question arises as to why only one type of token (say acoustic) is not sufficient for modeling audio via transformers. This was explored by Google in the AudioLM research paper [here](https://google-research.github.io/seanet/audiolm/examples/). In short, acoustic tokens are not a viable choice for long-term modeling of audio, and semantic tokens do not give any control over speech characteristics.

Here's an example sampled from a transformer model trained on acoustic tokens only:

<audio controls src="assets/indri/acoustic_token_modelling.wav" title="Acoustic modeling"></audio>

The audio generated carries the features of a human speaker, but the content does not make any sense since semantic tokens are missing from modeling.

Here are two different samples generated from a transformer model without any conditioning on acoustic tokens:

<audio controls src="assets/indri/different_voice_man.wav" title="Semantic sample 1"></audio>

<audio controls src="assets/indri/different_voice_woman.wav" title="Semantic sample 2"></audio>

Both the samples have the same content, but different voice characteristics.

In general, every audio signal is converted to two types of tokens - acoustic and semantic. If audio is sampled at 16KHz and is 10 seconds long, an acoustic tokenizer (for example, Encodec) will convert it into 300 * 10 = 3000 tokens (using 4 codebooks), and a semantic tokenizer (for example, HuBert) will convert it into 50 * 10 = 500 tokens. Acoustic tokens excel at capturing individual voice characteristics such as pitch, timbre, and vocal quality - essential for voice cloning where the goal is to replicate a specific person's voice. However, for complete style cloning (which includes speaking patterns, rhythm, and emotional expression), semantic tokens are crucial. Think of it this way: acoustic tokens capture "how the voice sounds," while semantic tokens capture "how the person uses that voice."

The temporal frequency of audio token generation significantly impacts model complexity. For instance, if a tokenizer generates one token every 20ms versus every 10ms, the resulting sequence will be half as long and thus easier to model. When designing or selecting a tokenizer, aim for the lowest token frequency that still maintains acceptable audio quality for your use case.

### Hierarchical modeling

Given these two types of audio tokens (acoustic and semantic), usually, the audio is modeled hierarchically.

1. First, a transformer model is trained to understand the relationship between text tokens and semantic audio tokens. This alignment means learning which semantic tokens correspond to which text tokens - for example, understanding which audio segments represent specific words or phonemes in the text. Due to semantic tokens' ability to preserve linguistic information, this mapping between text and audio becomes more straightforward. This model is trained to understand sequences of both modalities and can generate tokens of either modality. For example, if audio modeling is used to solve text-to-speech, this model will take in a sequence of text tokens and generate semantic audio tokens.
2. Second, a transformer model is used to convert semantic audio tokens to acoustic audio tokens. This is usually a non-autoregressive transformer.
3. Finally, acoustic audio tokens are decoded into audio signals.

This approach is also used in the famous [Bark](https://github.com/suno-ai/bark) model by Suno AI and [SpearTTS](https://arxiv.org/abs/2302.03540) by Google.

![heirarchical modeling of audio](assets/indri/image.png)
Hierarchical modeling using two types of tokens separately [Source](https://google-research.github.io/seanet/speartts/examples/)

Note that a similar architecture can be used to build an ASR model. Instead of using text tokens as input and semantic tokens as output, a transformer model can be trained with semantic tokens as input and text tokens as output.

> #### Streaming support
> To enable streaming for audio output, two things are required:
> 1. Streaming output of acoustic tokens
> 2. A tokenizer capable to accept streaming audio tokens and converting them to audio chunks in a streaming fashion
>
> However, the current hierarchical modeling approach presents challenges for streaming. The process requires generating all semantic tokens first, and only then converting them to acoustic tokens in a separate step. This two-stage process means we can't start generating audio until we have all the semantic tokens, creating a noticeable delay. For true streaming capability, we would need a model that can generate acoustic tokens progressively as text is processed, rather than waiting for the complete semantic token sequence.

### Single model modeling

Recently, new types of tokenizers have been released that use a single model to tokenize audio into both semantic and acoustic tokens. Some of them are:

1. [SpeechTokenizer](https://arxiv.org/abs/2308.16692)
2. [SNAC](https://arxiv.org/abs/2410.14411)
3. [WavTokenizer](https://arxiv.org/abs/2408.16532)
4. [Mimi](https://huggingface.co/docs/transformers/en/model_doc/mimi)

These tokenizers also have the ability to reconstruct the audio from the tokens. These tokenizers generate both acoustic and semantic tokens with the same temporal resolution (or frequency) - meaning for each time window of audio, they produce both types of tokens. This temporal alignment between acoustic and semantic tokens eliminates the need for a model that maps semantic tokens to acoustic tokens. Now, a single auto-regressive transformer model can be used to model the audio sequence.

For example, in a text-to-speech application using this approach:

1. During training, the model learns from paired data: input text tokens and their corresponding audio tokens (both semantic and acoustic tokens aligned in time)
2. During generation, the model takes text tokens as input and generates both semantic and acoustic tokens simultaneously. The generated tokens can then be decode directly into audio using the tokenizer.


Since the acoustic tokens are generated by an autoregressive model (which generates tokens one after another, using previous tokens as context), these tokens can be immediately decoded into audio chunks as they're produced. This is in contrast to the non-autoregressive approach in hierarchical modeling, which needed to wait for all semantic tokens before generating acoustic tokens. This sequential generation property makes the single model approach naturally suitable for streaming applications, provided the tokenizer supports streaming output.

## Learnings from building our own tokenizer

When we began exploring audio modeling, our options for publicly available tokenizers were limited primarily to HuBert. While using HuBert's semantic tokens, we encountered significant limitations - particularly its inability to effectively handle Hindi audio and non-speech data, as it was primarily trained on English speech. Our search for alternatives led us to w2v-BERT, referenced in Google's [AudioPalm](https://arxiv.org/abs/2306.12925) and [AudioLM](https://arxiv.org/abs/2209.03143) papers. We discovered its successor, w2v2-BERT, released with SeamlessM4T, which was trained on approximately 4.5 million hours of audio across more than 100 languages ([reference](https://huggingface.co/docs/transformers/en/model_doc/wav2vec2-bert)). However, the discretization process was missing for this model, which meant the embeddings could not be converted to discrete tokens.

To address this, we developed our own discretization pipeline using two approaches, Vector Quantized Variational Autoencoders (VQ-VAE) and K-means clustering.


Some key insights from our implementation

1. VQ-VAEs provided significant performance advantages over k-means due to GPU acceleration during discretization
2. Following AudioLM's approach, we extracted embeddings from the 7th layer of the Masked Language Model (MLM) module for discretization
3. Our dataset used for discretization included a balanced mix of English, Hindi, and non-speech audio, with discretization into 2,048 distinct clusters

We've open-sourced this work as a Python library [audiotoken](https://github.com/cmeraki/audiotoken) that supports both acoustic and semantic token generation.

With the emergence of single-shot tokenizers, we transitioned from w2v2-bert to Mimi (by Kyutai) due to several advantages:

| Feature | Previous Approach | Mimi |
|---------|------------------|------|
| Token Generation | Required manual discretization | Pre-released clusters |
| Temporal Resolution | ~300 tokens/second (combining acoustic and semantic tokens) | 12.5 samples/second (1 codebook) or 50 samples/second (4 codebooks) |
| Token Types | Separate processing for semantic and acoustic | Integrated (semantic in first codebook, acoustic in remaining) |
| Streaming Support | Limited | Native audio decoding support |

We plan to add support for additional single-shot tokenizers like Mimi and SNAC in audiotoken in upcoming releases.

This article has covered the journey from understanding audio tokenization fundamentals to implementing practical solutions. We hope these insights help you navigate the selection and implementation of audio tokenization for your specific use cases.

