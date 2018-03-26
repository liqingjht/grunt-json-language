var chalk = require("chalk");
var jsonError = "";

function correctJsonItem(line, row, fileName, lastLineError) {
	var arr = [];
	var isBreakUp;

	if (line.indexOf(":") == -1) {
		var name = line.replace(/^([^\s]*")\s+".*$/g, "$1");
		var value = line.replace(/^[^\s]*"\s+(".+?),?$/g, "$1");
		isBreakUp = false;
		if (name == "" || value == "" || name == line || value == line) {
			arr.push({
				"error": true,
				"item": line
			});
			storeJsonError(fileName, row, arr);
			return;
		}
	} else {
		isBreakUp = true;
		var name = line.replace(/^([^\s]*)\s*:.*$/g, "$1");
		var value = line.replace(/^[^:]*:\s*(.+?),?$/g, "$1");

	}

	arr = arr.concat(includeByQuote(name));
	arr.push({
		"error": !isBreakUp,
		"item": ' : '
	});
	arr = arr.concat(includeByQuote(value));

	arr.push({
		"error": (((line[line.length - 1] !== ',') ? true : false) || lastLineError),
		"item": ','
	});

	storeJsonError(fileName, row, arr);
}

function includeByQuote(str) {
	var arr = [];
	if (str.slice(0, 1) !== '"') {
		arr.push({
			"error": true,
			"item": '"'
		});
		str = '"' + str;
	} else {
		arr.push({
			"error": false,
			"item": '"'
		});
	}
	if (str.slice(str.length - 1) !== '"') {
		arr = arr.concat(transferQuote(str + '"'));
		arr.push({
			"error": true,
			"item": '"'
		});
	} else {
		arr = arr.concat(transferQuote(str));
		arr.push({
			"error": false,
			"item": '"'
		});
	}

	return arr;
}

function transferQuote(str) {
	var arr = [];
	str = str.trim();
	str = str.replace(/^"(.*)"$/g, "$1");
	var begin = 0;
	for (var i = 0; i < str.length; i++) {
		if (str[i] == '\\' && (i + 1 == str.length || (str[i + 1] != '"' && str[i + 1] != '\\'))) {
			arr.push({
				"error": false,
				"item": str.slice(begin, i)
			});
			arr.push({
				"error": true,
				"item": '\\\\'
			});
			begin = i + 1;
		} else if (str[i] == '"' && (i - 1 == 0 || str[i - 1] != '\\')) {
			arr.push({
				"error": false,
				"item": str.slice(begin, i)
			});
			arr.push({
				"error": true,
				"item": '\\"'
			});
			begin = i + 1;
		}
	}
	if (begin !== str.length - 1) {
		arr.push({
			"error": false,
			"item": str.slice(begin)
		});
	}

	return arr;
}

function storeJsonError(file, line, arr) {
	jsonError += "[" + chalk.cyan(file) + chalk.green(" +" + line) + "] ";
	for (var i = 0; i < arr.length; i++) {
		if (arr[i].error) {
			jsonError += chalk.red(arr[i].item)
		} else {
			jsonError += arr[i].item;
		}
	}
	jsonError += "\n";
}

function printJsonError() {
	console.log(jsonError.split('\n').reverse().join('\n') + '\n');
}

exports.correctJsonItem = correctJsonItem;
exports.printJsonError = printJsonError;
