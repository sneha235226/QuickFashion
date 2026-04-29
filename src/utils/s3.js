const { S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Delete a file from S3 by its key (the path after the bucket, e.g. "products/abc.jpg").
 */
const deleteFile = async (key) => {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

/**
 * Extract the S3 key from a full S3 URL.
 * e.g. https://bucket.s3.region.amazonaws.com/products/abc.jpg  → products/abc.jpg
 */
const keyFromUrl = (url) => {
  try {
    const { pathname } = new URL(url);
    return pathname.replace(/^\//, '');
  } catch {
    return url;
  }
};

/**
 * Construct the public S3 URL for a given key.
 * This ensures the URL follows the format: https://{bucket}.s3.{region}.amazonaws.com/{key}
 */
const getPublicUrl = (key) => {
  if (!key) return null;
  // If it's already a full URL, return it
  if (key.startsWith('http')) return key;

  const region = process.env.AWS_REGION || 'ap-south-1';
  return `https://${BUCKET}.s3.${region}.amazonaws.com/${key}`;
};

/**
 * Generate a signed URL for an S3 object.
 * This allows temporary access to private objects.
 */
const getSignUrl = async (key, expiresIn = 3600) => {
  if (!key) return null;
  // If it's already a full URL, extract the key if possible
  const actualKey = key.startsWith('http') ? keyFromUrl(key) : key;

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: actualKey,
  });

  return await getSignedUrl(s3, command, { expiresIn });
};

module.exports = { s3, BUCKET, deleteFile, keyFromUrl, getPublicUrl, getSignUrl };
