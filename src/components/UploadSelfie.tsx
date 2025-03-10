import React, { useState } from 'react';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { S3_BUCKET_NAME, s3Client, rekognitionClient } from '../config/aws';
import { CompareFacesCommand } from '@aws-sdk/client-rekognition';
import { Camera, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const UploadSelfie = () => {
    const [selfie, setSelfie] = useState<File | null>(null);
    const [matchedImages, setMatchedImages] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const validateImage = (file: File) => {
        // Check file type
        if (!file.type.match(/^image\/(jpeg|png)$/)) {
            throw new Error('Only JPEG and PNG images are supported');
        }

        // Check file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Image size must be less than 5MB');
        }
        return true;
    };

    const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                validateImage(file);
                setSelfie(file);
                setPreviewUrl(URL.createObjectURL(file));
                setUploadError(null);
            } catch (error: any) {
                setUploadError(error.message);
            }
        }
    };

    const compareFaces = async (selfieUrl: string) => {
        try {
            const listCommand = new ListObjectsV2Command({
                Bucket: S3_BUCKET_NAME,
                Prefix: 'uploads/',
            });
    
            const listResponse = await s3Client.send(listCommand);
            if (!listResponse.Contents || listResponse.Contents.length === 0) {
                console.log('No images found in uploads directory');
                return [];
            }
    
            const uploadKeys = listResponse.Contents.map(item => item.Key).filter(key => key && key !== 'uploads/');
            const matchedUrls: string[] = [];
    
            for (const key of uploadKeys) {
                try {
                    const compareCommand = new CompareFacesCommand({
                        SourceImage: {
                            S3Object: {
                                Bucket: S3_BUCKET_NAME,
                                Name: `selfies/${selfieUrl}`,
                            },
                        },
                        TargetImage: {
                            S3Object: {
                                Bucket: S3_BUCKET_NAME,
                                Name: key,
                            },
                        },
                        SimilarityThreshold: 99, // Adjusted threshold for better matching
                    });
    
                    const compareResponse = await rekognitionClient.send(compareCommand);
                    if (compareResponse.FaceMatches && compareResponse.FaceMatches.length > 0) {
                        matchedUrls.push(`https://${S3_BUCKET_NAME}.s3.amazonaws.com/${key}`);
                        console.log(`Face match found in image: ${key}`);
                    }
                } catch (error: any) {
                    if (error.name === 'InvalidParameterException') {
                        console.log(`No face detected in image: ${key}`);
                        continue;
                    }
                    console.error(`Error comparing with image ${key}:`, error);
                    continue;
                }
            }
    
            return matchedUrls;
        } catch (error) {
            console.error("Error in face comparison process:", error);
            throw new Error("Failed to process face comparison. Please try again.");
        }
    };

    const clearSelfie = () => {
        setSelfie(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
    };

    const uploadToS3 = async (file: File, fileName: string) => {
        try {
            console.log(`Uploading file: ${fileName}`);

            const uploadParams = {
                Bucket: S3_BUCKET_NAME,
                Key: `selfies/${fileName}`,
                Body: file,
                ContentType: file.type,
            };

            const upload = new Upload({
                client: s3Client,
                params: uploadParams,
                partSize: 5 * 1024 * 1024, // 5MB part size for large files
                leavePartsOnError: false,
            });

            // Start the upload
            const data = await upload.done();
            console.log('Upload success:', data);

            return `https://${S3_BUCKET_NAME}.s3.amazonaws.com/selfies/${fileName}`;
        } catch (error) {
            console.error("Error uploading to S3:", error);
            throw error;
        }
    };



    const handleUpload = async () => {
        if (!selfie) {
            setUploadError("Please select a selfie to upload.");
            return;
        }

        setIsUploading(true);
        setUploadError(null);

        try {
            const fileName = `${Date.now()}-${selfie.name}`;
            await uploadToS3(selfie, fileName);
            const matchedUrls = await compareFaces(fileName);
            setMatchedImages(matchedUrls);
        } catch (error) {
            console.error('Error uploading selfie:', error);
            setUploadError("Error uploading selfie. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Upload Selfie</h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="selfie-upload" className="w-full flex flex-col items-center px-4 py-6 bg-white rounded-lg border-2 border-gray-300 border-dashed cursor-pointer hover:border-indigo-600 hover:bg-gray-50">
                            <div className="flex flex-col items-center">
                                {previewUrl ? (
                                    <div className="relative group">
                                        <img
                                            src={previewUrl}
                                            alt="Selfie preview"
                                            className="w-32 h-32 object-cover rounded-full mb-4"
                                        />
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                clearSelfie();
                                            }}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <Camera className="w-8 h-8 text-gray-400 mb-4" />
                                )}
                                <p className="mt-2 text-sm text-gray-500">
                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Take a clear selfie for best results
                                </p>
                            </div>
                            <input
                                id="selfie-upload"
                                type="file"
                                className="hidden"
                                onChange={handleSelfieChange}
                                accept="image/*"
                                capture="user"
                            />
                        </label>
                    </div>

                    {uploadError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                            {uploadError}
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={isUploading || !selfie}
                        className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isUploading || !selfie ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isUploading ? 'Uploading...' : 'Upload Selfie'}
                    </button>
                </div>

                {matchedImages.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Matched Images</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {matchedImages.map((url, index) => (
                                <div key={index} className="aspect-w-1 aspect-h-1">
                                    <img
                                        src={url}
                                        alt={`Matched face ${index + 1}`}
                                        className="w-full h-full object-cover rounded-lg"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 text-center">
                            <Link
                                to="/"
                                className="inline-flex items-center text-indigo-600 hover:text-indigo-500"
                            >
                                ← Back to home
                            </Link>
                        </div>
                    </div>
                )}

                {matchedImages.length === 0 && !isUploading && selfie && (
                    <p className="mt-4 text-sm text-gray-600 text-center">
                        No matched faces found
                    </p>
                )}
            </div>
        </div>
    );
};

export default UploadSelfie;