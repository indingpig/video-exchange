const data202309 = require('./data.json')
const data202310 = require('./10month.json')
const data202311 = require('./11month.json')
const data202312 = require('./12month.json')
const data202401 = require('./202401.json')
const data202402 = require('./202402.json')
const data202403 = require('./202403.json')
const data202404 = require('./202404.json')
const data202405 = require('./202405.json')
const data202406 = require('./202406.json')
const data202407 = require('./202407.json')
const data202408 = require('./202408.json')
const data202409 = require('./202409.json')
const data202410 = require('./202410.json')
const data202411 = require('./202411.json')
const data202412 = require('./202412.json')
const data202501 = require('./202501.json')


let dataList = {
	data202309,
	data202310,
	data202311,
	data202312,
	data202401,
	data202402,
	data202403,
	data202404,
	data202405,
	data202406,
	data202407,
	data202408,
	data202409,
	data202410,
	data202411,
	data202412,
	data202501
}
let keyNameList = Object.keys(dataList);
let preData = 0;
keyNameList.forEach((key) => {
	let currentData = dataList[key];
	let year = key.substring(4);
	let sum = {value: 0};
	sum = currentData.data.dataTs.reduce((pre, cur) => {
		return {value: pre.value + cur.value}
	}, sum);
	sum = sum.value;
	let rate = 0;
	if (preData) {
		rate = (((sum - preData) / preData) * 100).toFixed(2) + '%';
	}
	console.log(year, sum, sum - preData, rate);
	preData = sum;
});