import React, { useState } from 'react';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage'; // Import the Upload class here
import { S3_BUCKET_NAME } from '../config/aws';
import { Upload as UploadIcon, X } from 'lucide-react';

const UploadImage = () => {
    const [images, setImages] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setImages(Array.from(e.target.files));
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const uploadToS3 = async (file: File, fileName: string) => {
        try {
            console.log(`Uploading file: ${fileName}`);

            const s3Client = new S3Client({
                region: 'us-east-1', // Ensure this matches your S3 region
                credentials: {
                    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
                    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
                },
            });

            const uploadParams = {
                Bucket: S3_BUCKET_NAME,
                Key: `uploads/${fileName}`,
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

            return `https://${S3_BUCKET_NAME}.s3.amazonaws.com/uploads/${fileName}`;
        } catch (error) {
            console.error("Error uploading to S3:", error);
            throw error;
        }
    };

    const handleUpload = async () => {
        if (images.length === 0) {
            alert("Please select at least one image to upload.");
            return;
        }

        setIsUploading(true);
        setUploadSuccess(false);

        try {
            const uploadPromises = images.map(async (image) => {
                const fileName = `${Date.now()}-${image.name}`;
                const imageUrl = await uploadToS3(image, fileName);
                return imageUrl;
            });

            const uploadedUrls = await Promise.all(uploadPromises);
            console.log('Uploaded images:', uploadedUrls);

            // In development, generate a mock QR code
            setQrCodeUrl('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://example.com/upload_selfie');
            setUploadSuccess(true);
        } catch (error) {
            console.error('Error uploading images:', error);
            alert("Failed to upload images. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Upload Images</h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="file-upload" className="w-full flex flex-col items-center px-4 py-6 bg-white rounded-lg border-2 border-gray-300 border-dashed cursor-pointer hover:border-indigo-600 hover:bg-gray-50">
                            <div className="flex flex-col items-center">
                                <UploadIcon className="w-8 h-8 text-gray-400" />
                                <p className="mt-2 text-sm text-gray-500">
                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    PNG, JPG, GIF up to 10MB
                                </p>
                            </div>
                            <input
                                id="file-upload"
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleImageChange}
                                accept="image/*"
                            />
                        </label>
                    </div>

                    {images.length > 0 && (
                        <div className="mt-4">
                            <p className="text-sm text-gray-600 mb-2">{images.length} file(s) selected</p>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(images).map((image, index) => (
                                    <div key={index} className="relative group">
                                        <img
                                            src={URL.createObjectURL(image)}
                                            alt={`Preview ${index + 1}`}
                                            className="w-20 h-20 object-cover rounded"
                                        />
                                        <button
                                            onClick={() => removeImage(index)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={isUploading || images.length === 0}
                        className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isUploading ? 'Uploading...' : 'Upload Images'}
                    </button>
                </div>

                {uploadSuccess && (
                    <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-center mb-4">
                            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                Upload successful!
                            </div>
                        </div>

                        <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">Scan this QR Code to Upload a Selfie</h3>
                        <div className="flex flex-col items-center">
                            <img src={qrCodeUrl} alt="QR Code for Selfie Upload" className="w-48 h-48" />
                            <p className="mt-4 text-sm text-gray-600">
                                Or click{' '}
                                <a
                                    href="/upload_selfie"
                                    className="text-indigo-600 hover:text-indigo-500"
                                >
                                    here
                                </a>{' '}
                                to upload your selfie
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadImage;
