/* grunt-json-language
 * mailTo: liqingjht@163.com
 * Copyright (c) 2017 liqingjht
 * Licensed under the MIT license.
*/

'use strict';

module.exports = function (grunt) {
	var fs = require("fs");
	var chalk = require("chalk");
	var child_process = require("child_process");
	var ProgressBar = require("progress");
	var path = require("path");
	var correct_json = require("./lib/correct_json.js");
	var [jsonFiles, cacheJson, uniqueKeys, cacheFlag] = [[], [], {}, true], progressBar, opts;

	grunt.registerMultiTask('json_language', 'manage language json files', json_language);
	async function json_language() {
		opts = this.options({
			check: true,
			sync: true,
			unique: true,
			rev_unused: false,
			pretty: false,
			minimum: false,
			www_out: "build/",
			eng_file: "en-US.json",
			ignore: ["languagesList.json"]
		});
		this.files.forEach(f => {
			f.src.filter(p => {
				if (opts.ignore.indexOf(path.basename(p)) == -1 && grunt.file.isFile(p) && path.extname(p) == ".json") jsonFiles.push(p);
			})
		})

		var done = this.async();
		if(opts.rev_unused || opts.pretty || opts.minimum) {
			opts.check = true;
			opts.unique = true;
		}
		try {
			if (opts.check)
				await checkFunc(cacheFlag);
			if (opts.sync) {
				await syncFunc(cacheFlag);
				cacheFlag = false;
			}
			if (opts.rev_unused) {
				await removeUnusedFunc(cacheFlag);
				cacheFlag = false;
			}
			if (opts.pretty) {
				await prettyMiniFunc("p", cacheFlag);
				cacheFlag = false;
			}
			if (opts.minimum)
				await prettyMiniFunc("m", cacheFlag);
		} catch (err) {
			console.log(chalk.red(err));
			process.exit(1);
		}

		done();
	}

	function checkFunc(cacheFlag) {
		return new Promise(async function (resolve, reject) {
			try {
				var obj = await readJsonData(cacheFlag);
				console.log("");
				initNewProgressBar("Checking", obj.length);
				await checkJsonData(obj, resolve, reject, function () {
					console.log(chalk.red("Please correct error items before your next step."));
					process.exit(1);
				});
			} catch (err) {
				reject(err);
			}
		})
	}

	function syncFunc(cacheFlag) {
		return new Promise(async function (resolve, reject) {
			try {
				var obj = await readJsonData(cacheFlag);
				var msg = await syncEnglishItem(obj);
				printProgress(msg[0]);
				resolve();
			} catch (err) {
				reject(err);
			}
		})
	}

	function removeUnusedFunc(cacheFlag) {
		return new Promise(async function (resolve, reject) {
			try {
				var obj = await readJsonData(cacheFlag);
				var webData = await readWebData();
				var msg = await removeUnusedItem(obj, webData.join(" "));
				printProgress(msg[0]);
				resolve();
			} catch (err) {
				reject(err);
			}
		})
	}

	function prettyMiniFunc(flag, cacheFlag) {
		return new Promise(async function (resolve, reject) {
			try {
				var obj = await readJsonData(cacheFlag);
				var msg = await prettyMiniJsonFormat(obj, flag == "p", flag == "m");
				printProgress(msg[0]);
				resolve();
			} catch (err) {
				reject(chalk.red(err));
			}
		})
	}

	function checkJsonData(obj, resolve, reject, failHander) {
		var formatErr = false;
		for (var i = 0; i < obj.length; i++) {
			var data = obj[i].data;
			var file = obj[i].file;

			/*it may no error when call JSON.parse, but the result is unexpected. So check line by line.*/
			var lines = data.split("\n");
			var findLast = false;
			for (var j = lines.length - 1; j > -1; j--) {
				var line = lines[j].trim();
				if (line == "{" || line == "}" || line == "") {
					continue;
				}
				try {
					var lastLineError = false;
					if (findLast === false) {
						if (line.slice(-1) != ",")
							line = line + ",";
						else
							lastLineError = true;
						findLast = true;
					}
					var temp = JSON.parse('{' + line + '"D":"F"}');
					if (Object.keys(temp).length != 2 || lastLineError)
						throw new Error();
					for (var tempKey in temp) {
						if(tempKey == "D")
							continue;
						if (/[\r\n\t]/g.test(temp[tempKey]))
							throw new Error();
						
						if(opts.unique) {
							if(uniqueKeys[tempKey] === undefined) {
								uniqueKeys[tempKey] = {};
								uniqueKeys[tempKey][file] = [];
								uniqueKeys[tempKey][file].push(j + 1);
							}
							else {
								if(uniqueKeys[tempKey][file] === undefined) {
									uniqueKeys[tempKey][file] = [];
									uniqueKeys[tempKey][file].push(j + 1);
								}
								else {
									var matched = false;
									var curVal = lines[j].trim().replace(/^"[^"]+"\s*:\s*"(.*?)",?$/g, "$1");
									for(var k=0; k<uniqueKeys[tempKey][file].length; k++) {
										var val = lines[parseInt(uniqueKeys[tempKey][file][k]) - 1];
										val = val.trim().replace(/^"[^"]+"\s*:\s*"(.*?)",?$/g, "$1");
										if(curVal == val)
											matched = true;
									}
									if(!matched)
										uniqueKeys[tempKey][file].push(j + 1);
								}
							}
						}
					}
				} catch (lineErr) {
					correct_json.correctJsonItem(line, j + 1, file, lastLineError);
					formatErr = true;
				}
			}

			progressBar.tick();
		}
		if (formatErr) {
			correct_json.printJsonError();
			reject();
			if (failHander) {
				failHander();
			}
		} else {
			printProgress("check");
			var keysErr = false;
			if(opts.unique) {
				for(var key in uniqueKeys) {
					for(var file in uniqueKeys[key]) {
						if(uniqueKeys[key][file].length > 1) {
							console.log(`${chalk.red(">>")} ${chalk.yellow(key)}: \n\t${file} [+${uniqueKeys[key][file].join(" +")}]`);
							keysErr = true;
						}
					}
				}
			}

			if(keysErr)
				reject("\nFind some duplicate keys with different values");
			else
				resolve();
		}
	}

	function syncEnglishItem(obj) {
		var engObj;
		for (var z = 0; z < obj.length; z++) {
			if (obj[z].file == opts.eng_file) {
				engObj = JSON.parse(obj[z].data);
				obj.splice(z, 1);
				break;
			}
		}
		if (engObj === undefined) {
			return new Promise(function (resolve, reject) {
				reject(`Can't find ${opts.eng_file}`)
			});
		}

		return Promise.all(obj.map(function (eachObj) {
			return new Promise(function (resolve, reject) {
				var fileName = eachObj.file;
				var multiLang = JSON.parse(eachObj.data);
				var multiKeys = Object.keys(multiLang);
				var syncKeys = [];

				var maxLength = 0;
				for (var engKey in engObj) {
					var index = multiKeys.indexOf(engKey);
					if (index === -1) {
						syncKeys.push(engKey);
						maxLength = (maxLength < engKey.length) ? engKey.length : maxLength;
					}
				}

				var saver = "{\n";
				for (var i = 0; i < syncKeys.length; i++) {
					saver += ('\t"' + syncKeys[i] + '"');
					saver += (new Array(maxLength - syncKeys[i].length + 2)).fill(" ").join("") + ': ';
					saver += '"' + engObj[syncKeys[i]].replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '",\n';
				}

				var firstLine = eachObj.data.indexOf("\n");
				saver += eachObj.data.slice(firstLine + 1);

				fs.writeFile(path.resolve(path.join(path.dirname(jsonFiles[0]), fileName)), saver, 'utf-8', function (writeErr) {
					if (writeErr) {
						reject("Occur error when sync " + fileName);
						return;
					}
					resolve("sync");
				});
			});
		}))
	}

	function removeUnusedItem(obj, webData) {
		var allKeys = [];
		try {
			for(var i=0; i<obj.length; i++) {
				var jsonObj = JSON.parse(obj[i].data);
				var keys = Object.keys(jsonObj);
				for(var j=0; j<keys.length; j++) {
					if(allKeys.indexOf(keys[j]) == -1)
						allKeys.push(keys[j]);
				}
				obj[i].data = jsonObj;
			}

			for(var i=0; i<allKeys.length; i++) {
				if(webData.indexOf(allKeys[i]) == -1) {
					allKeys.splice(i, 1);
					i --;
				}
			}
		}
		catch(err) {
			return new Promise((resolve, reject) => {reject(["Occur error when parse JSON for removing"])});
		}

		return Promise.all(obj.map(function (eachObj) {
			return new Promise(function (revResolve, revReject) {
				var file = eachObj.file;
				var jsonObj = eachObj.data;
				var keys = Object.keys(jsonObj);

				var originLength = keys.length;
				for(var i=0; i<keys.length; i++) {
					if (allKeys.indexOf(keys[i]) == -1) {
						keys.splice(i, 1);
						i --;
					}
				}

				var saver = "{\n";
				for (var i = 0; i < keys.length; i++) {
					saver += ('\t"' + keys[i] + '" : ');
					saver += '"' + jsonObj[keys[i]].replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
					if (i !== keys.length - 1)
						saver += ",";
					saver += "\n";
				}
				saver += "}";
				
				//blocked by IO, so print logs before write files
				console.log(`${chalk.green('>>')} ${file} ${originLength} items -> ${keys.length} items`);
				fs.writeFile(path.join(path.dirname(jsonFiles[0]), file), saver, "utf-8", function (writeErr) {
					if (writeErr) {
						revReject(writeErr);
						return;
					}
					revResolve("remove unused items");
				});
			})
		}))
	}

	function prettyMiniJsonFormat(obj, pretty, mini) {
		return Promise.all(obj.map(function (eachObj) {
			return new Promise(function (resolve, reject) {
				var p = pretty === undefined ? opts.pretty : pretty;
				var m = mini === undefined ? opts.minimum : mini;
				var msg = (p ? (m ? "pretty and minify" : "pretty") : "minify");
				var fileName = eachObj.file;
				var data = eachObj.data;
				var ori = JSON.parse(data);
				var keys = Object.keys(ori);
				var maxLength = 0;

				if (p) {
					keys.sort(function (a, b) {
						return b.length - a.length
					});
					maxLength = keys[0].length;

					keys.sort();
				}

				var saver = (m ? "{" : "{\n");
				for (var i = 0; i < keys.length; i++) {
					saver += ((m ? '"' : '\t"') + keys[i] + '"' + (m ? "" : ((new Array(maxLength - keys[i].length + 2)).fill(" ").join(""))));
					saver += ((m ? ':"' : ': "') + ori[keys[i]].replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
					if (i !== keys.length - 1)
						saver += ",";
					if (!m)
						saver += "\n";
				}
				saver += "}";

				try {
					var res = JSON.parse(saver);
					for (var name in res) {
						if (ori[name] === undefined || res[name] != ori[name]) {
							reject("Occur error when " + msg + " " + fileName);
						}
					}
					fs.writeFile(path.resolve(path.join(path.dirname(jsonFiles[0]), fileName)), saver, 'utf-8', function (writeErr) {
						if (writeErr) {
							reject("Occur error when " + msg + " " + fileName);
							return;
						}
						resolve(msg);
					});
				} catch (err) {
					reject("Occur error when " + msg + " " + fileName);
				}
			});
		}))
	}

	function printProgress(msg) {
		if (msg == "check") {
			msg = "Pass the checking for json format";
		} else {
			msg = "Have done the " + msg + " process";
		}
		console.log("\n" + chalk.green(msg) + "\n");
	}

	function readJsonData(cacheFlag) {
		if (cacheFlag && cacheJson.length > 0)
			return cacheJson;
		else
			cacheJson = [];
		return Promise.all(jsonFiles.map(function (file) {
			return new Promise(function (resolve, reject) {
				fs.readFile(path.resolve(file), "utf-8", function (readErr, data) {
					if (readErr) {
						console.log(readErr);
						process.exit(1);
					}
					data.replace(/\r\n/g, "\n");
					cacheJson.push({
						"file": path.basename(file),
						"data": data
					});
					resolve({
						"file": path.basename(file),
						"data": data
					});
				});
			})
		}))
	}

	function readWebData() {
		var result = child_process.execSync(`find ${path.resolve(opts.www_out)} -regex '.*\\.js\\|.*\\.html\\|.*\\.htm'`);
		var allFiles = result.toString().split("\n");
		allFiles = allFiles.filter((val) => {
			return !(val.trim() === "")
		});
		var webData = "";

		return Promise.all(allFiles.map(function (file) {
			return new Promise(function (resove, reject) {
				fs.readFile(file, "utf-8", function (err, data) {
					if (err) {
						reject(err);
						return;
					}
					resove(data.replace(/(\t|\s{2}\s*)/g, " "));
				});
			})
		}))
	}

	function initNewProgressBar(name, total) {
		progressBar = new ProgressBar(chalk.cyan(name) + chalk.yellow(" [") + ":bar" + chalk.yellow("] ") + ":current/:total :percent [:etas]", {
			curr: 0,
			total: total,
			width: 35,
			complete: "=",
			incomplete: " ",
			clear: true
		});
	}
};
