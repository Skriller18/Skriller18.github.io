# Comparing Deep Learning Models for Plant Monitoring

Research adaptation · Om Mangalgi and Subhash Gupta P · With guidance from Dr Vijayalakshmi M.N.

If a camera on a rover or drone is going to help monitor a field, its vision model must distinguish the crop from the weeds around it. We compared four established image classification architectures on cotton crop and cotton weed images, then asked a practical question: **does masking the background before training change the result?**

This article adapts our paper, *Comprehensive comparison of different Deep-Learning models for Plant Monitoring System*, into a shorter explanation of the experiment and its findings.

## The problem

Plant monitoring can support tasks such as weed detection, crop counting, and health assessment. Images collected in a field, however, contain more than the plant: soil, shadows, changing light, and other background details all become part of the input. A model might learn from those details rather than from the crop itself.

We used a dataset of **400 cotton crop images and 400 cotton weed images**, captured from different angles and in different lighting conditions. The images were cleaned, resized, augmented, and divided into training and test sets using an 80/20 split.

## Four models, two versions of the images

We compared **ResNet, VGG19, InceptionV3, and EfficientNet**. Each model was evaluated on the original images and on a second version prepared with color-based masking.

The masking pipeline converted images from RGB to HSV color space. An interactive Python tool helped identify a hue, saturation, and value range for the plants and suppress background pixels. The ranges recorded in the paper were hue 25–84, saturation 0–255, and value 0–180. The aim was to direct the classifier toward the plant and weed regions while reducing irrelevant visual noise.

## What we observed

The reported results did not point to one universal winner for every version of the dataset:

| Observation | Result reported in the paper |
| --- | --- |
| Highest unmasked accuracy | InceptionV3, 100% |
| Other strong unmasked result | EfficientNet, 96.34% |
| Highest masked accuracy | VGG19, 97.56% |
| EfficientNet with masking | 96.34% |
| ResNet accuracy after masking | 75% → 93.75% |
| ResNet loss after masking | 68.56% → 20.46% |
| EfficientNet training time | 2,821 s → 908 s |

**ResNet showed the clearest gain from preprocessing.** Its accuracy rose by 18.75 percentage points after masking, while its reported loss fell sharply. The training-time comparison for EfficientNet also suggests that removing background information made this particular run substantially faster.

The paper considered EfficientNet the most robust overall across the tested conditions, even though InceptionV3 and VGG19 reached the highest accuracy in individual comparisons. These are results for this dataset and experimental setup; they should not be read as a general ranking of the architectures.

## What this taught us

Model architecture matters, but so does the image the model receives. In this experiment, preprocessing had a large effect on ResNet and reduced training time in the EfficientNet comparison. Masking gave us a way to test whether the classifier could concentrate on the plant rather than the surrounding scene.

For a real plant-monitoring system, the next question is how that approach holds up across more fields, crop varieties, weather, lighting, and camera hardware. A useful model must keep working when conditions move beyond the images used in this study.

---

*Based on research by Om Mangalgi and Subhash Gupta P at R.V. College of Engineering, guided by Dr Vijayalakshmi M.N. Numerical results are reproduced from the supplied paper.*
