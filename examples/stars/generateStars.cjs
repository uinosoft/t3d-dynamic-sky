const fs = require('fs');
const path = require('path');

const Z_UP = true;

// Function to read binary data from file
function readBinaryFile(filePath) {
	const buffer = fs.readFileSync(filePath);
	return new Float32Array(buffer.buffer);
}

// Function to write binary data to file
function writeBinaryFile(filePath, data) {
	fs.writeFileSync(filePath, data);
}

// Function to filter stars based on brightness threshold
function filterStars(data, count) {
	const numStars = data.length / 6;

	const brightnessInfos = [];

	for (let i = 0; i < numStars; i++) {
		const offset = i * 6;
		const r = data[offset + 3], g = data[offset + 4], b = data[offset + 5];
		const bs = r * r + g * g + b * b;
		brightnessInfos.push({ offset, bs });
	}

	brightnessInfos.sort((a, b) => b.bs - a.bs);

	count = Math.min(count, numStars);

	const filteredData = [];

	for (let i = 0; i < count; i++) {
		const offset = brightnessInfos[i].offset;

		if (Z_UP) {
			const temp = data[offset + 1];
			data[offset + 1] = data[offset + 2];
			data[offset + 2] = temp;
		}

		for (let j = 0; j < 6; j++) {
			filteredData.push(data[offset + j]);
		}
	}

	console.log(`Filtered ${count} stars out of ${numStars}`);

	return new Float32Array(filteredData);
}

// Main function to generate filtered stars data

const brightnessThreshold = parseFloat(process.argv[2]);
if (isNaN(brightnessThreshold)) {
	console.error('Please provide a valid brightness threshold.');
	process.exit(1);
}

const inputFilePath = path.resolve(__dirname, 'StarsData.bytes');
const stars = readBinaryFile(inputFilePath);

const filteredStars = filterStars(stars, brightnessThreshold);

const outputFilePath = path.resolve(__dirname, `StarsData-${filteredStars.length / 6}.bin`);
writeBinaryFile(outputFilePath, filteredStars);

console.log(`Filtered stars data saved to ${outputFilePath}`);
