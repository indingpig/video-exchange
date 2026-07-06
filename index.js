const { log } = require('console');
const fs = require('fs');
const path = require('path');

const fileJsons = async () => {
	const files = await fs.promises.readdir(path.join('./houseData'));
	const fileJsonArray = Promise.all(
		files.map(async (file) => {
			const filePath = path.join('./houseData', file);
			const key = `data${file.split('.')[0]}`;
			const conent =  await fs.promises.readFile(filePath, 'utf-8');
			return {
				key,
				conent: JSON.parse(conent)
			}
		})
	)
	return fileJsonArray;
}


fileJsons().then(data => {
	let preData = 0;
	data.forEach((item, index) => {
		const {key, conent} = item;
		const year = key.substring(4);
		let sum = {value: 0};
		sum = conent.data.dataTs.reduce((pre, cur) => {
			return {value: pre.value + cur.value}
		}, sum);
		sum = sum.value;
		let rate = 0;
		if (preData) {
			rate = (((sum - preData) / preData) * 100).toFixed(2) + '%';
		}
		log(year, sum, sum - preData, rate);
		preData = sum;
	})
})