import crypto from 'crypto';

export function decryptRequest(body, privatePem) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  // Decrypt the AES key created by the client
  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: crypto.createPrivateKey(privatePem),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64"),
  );

  // Decrypt the Flow data
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(initial_vector, "base64");

  const TAG_LENGTH = 16;
  const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    initialVectorBuffer,
  );
  decipher.setAuthTag(encrypted_flow_data_tag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encrypted_flow_data_body),
    decipher.final(),
  ]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
}

// Test data
const body =  {
  encrypted_flow_data: 'y+bd7Tawa2GFehImrRdM5OTK9D+lmtfFTT7gR9HZOPiWCYEXtKYZtfuhiNltVEOavA==',
  encrypted_aes_key: 'oi0Zld9XYISr+MLN+BgkBS44i90ubhMX1KJWlRGJnU3e0f3GfRY6YSrgTILIqvU/kowH09GzoYZLG+g4DCo3SDJ14+eMr/vZ+N5v9UZfBL2orDm1EqwiHNsUrQn2QghNag6ihrS7KGRfVILvzFrXSdfVsgPwHuXfkN1g4gY9A2UmpVUg6O3GFPjZqe33GVx+UYUBXFR4soMM/6wZNxK55/3afRSt8WOXmHogokiUwXgvTWjrJLyJ9KSAmELBMlCatFY+1HH9fhSVlmE4KBvqlR5OtKP8wpbZHID77FGqwYqeNlapfw5pw+LN5nYsjKG/Fc9VuUiCnfDXXkw7IFBsNQ==',
  initial_vector: 'N+WGAjj+buaFlYWn/KiPIA=='
}

// This is a PUBLIC key in the example, but the function expects a PRIVATE key
// For testing, you'll need to replace this with a valid private key
// NOTE: In the real code, make sure to use the correct private key
const privatePem = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+FxVlOO/UAyv0
zqSvCifrTc/XyST1zE+UeTDt9K3a4KTXEiWhLJKptuv01Okz4s7g7rfiruhg31Jh
0n/QnaO2OyRro5F4kNGNEgaW7Xy+ZQWtA9mONakQLur1d0iJ/oufwEHMpZ0vWD+R
kyel0+PjRE1hU8NQq1tOW9RNsdsqq/LppJS+YhcKHgEiwR29fsYTcEgJ4qVK3yGg
tckBYXfGg6A9mvfoQ5Guc/9AMRvxag4aA8XdRXBioawMlpauJ3gdrdpkEDXzLCGn
jAABW+XdjC+sOJzCEv6NtofUM53HAZlH7Eg/AUEG2JlKalj68R+LwyuQx2x9Gl2E
1V980xZtAgMBAAECggEAAIzaf8AW6WZFgZr6Szf3Do8pvOAE6/OL6fov74qcPIxs
MGO7lcL7oLGExGERf2Zr+AptSuL74rUB4lfEqeLkQcdp/VLFL3CDpd93u+pE5RT2
1JpKDjk80PQ0CLuwIJc8m/IumT3ZXcNMmc4E7jh5e7HIABzQGBvgMt1kdTqOz8KN
itP+SKYmNR43l3AUGcbUdhxxrY4yuU4FUfcosJCt6WEw7nG+xKxEtRm+/pKYz07f
ZF8ilG7bRELVOWzvshcngiZc7Li0p/8cje7vqu9NjdxHtRzHNHOdOn1cmsvPOYg/
nGsua3rednymTIKCOplVESjFlurj9/FOaUtZuNqWwQKBgQDiZqTKBHHYwH0kxaje
H38PBG8MD0FlojNuILwZOKryJVDhIuOgKwf1GbTcMC+6ta+1wo7v83XfFfW1Si6k
n2HF6WIuP42iI+InL1a5bgOuWZWqnLBkzB/UWTl9I2x/xZxnWubzBLvjYJB67PJc
mup+CvoZpDo8t8RUEdr8/ycfQQKBgQDW8SnZ+p6HBuPxQoL/X0OVP/DWUH4oma7e
cPidc0Tay8HnEgF3ye3WVpSl8zRVZzEYxWg6/9OliKq1hTKWcL3D8AR/AaiRIzx9
PUDfb1vn0nW8DKo9uT1oqyBImACOkXUL1pV20sqY9hcTF11sNDu2sdlEIE+PvQSW
Q+DVc2SYLQKBgQCnYiXxacnV67JaLnzEBFtG+gszyk+aWYpWoIMQzpGsRyR93vKV
p1rRvji2FjYjf1IyOm69Pq1lyvGHIBpOAbwiu4KoGLqZJph8SgZ/P7QfAgKiSggr
7bKWp4TWXQtJiAszasSW5WgYGnuXNnmVN7+ogmsX7BBWdbMESNMz+1ysQQKBgBCl
1SwA8U5cBkOldyf4ZO+maCzxRxQ18wlfjqIDT43ywi33gw2YIke7pP/FeoQy3eah
Q5VuQyJLF42/p09npAsNCAweQMQdCo5YtDGaGnA2KNBL2tO1CUCWIIX+3+wq7/ne
wOzXHsICLX9ZC+9ZjFZ2J/HS3tavOS+6Siu+KEhxAoGBALQJZFdHzB/NniW36jw4
G4lh/StPGPrSm1MNcBLBLIOdl0p56Y8b3iOsane9UMRiKHEQwFxvufb5jijoJX+p
CWf4H03UbN/7Bwgelpp4xd4c7XLHPgvQVKCuDrpfrv0t5PWCrwBb324q9ouAUb/R
wXf3wtLxDH0PM7mvAhsCR+BS
-----END PRIVATE KEY-----`;

try {
  const res = decryptRequest(body, privatePem);
  
  console.log("Decryption successful!");
  console.log("🎉 🔓🔓 🎉🔓 🎉🔓 🎉🔓 🎉🔓 🎉🔓 🎉 🔓 🎉");
  console.log("Decrypted body:", res.decryptedBody);  
  console.log("🎉 🔓🔓 🎉🔓 🎉🔓 🎉🔓 🎉🔓 🎉🔓 🎉 🔓 🎉");
} catch (error) {
  console.error("Decryption failed:", error.message);
}

// Helper function to test with different inputs
export function testDecryption(testBody, testPrivateKey) {
  try {
    const result = decryptRequest(testBody, testPrivateKey);
    return {
      success: true,
      result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}