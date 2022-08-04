require("dotenv").config();

const { INTERNAL_SERVER_ERROR_CODE } = require("../constants/errCode");
const { dbRun, dbAll } = require("../models/database");
const { uniqueId, renameObjectKey, logError, handler } = require("../utils")
const deviceModel = require("../models/device.model");

class DeviceController {
	handleErrCreate = async (id) => {
		const getDevice = `SELECT * FROM DEVICE WHERE ID = ?`;
		const device = await dbAll(getDevice, id);

		if (device) {
			const deleteQuery = `DELETE FROM DEVICE WHERE ID = ?`;
			await dbRun(deleteQuery, id);
		}
	};

	setupTagSql = (tagList, protocolName, id) => {
		tagList.forEach(tag => {
			tag.deviceID = id;
		});

		const bracketValue =
			"(" + ",?".repeat(Object.values(tagList[0]).length).slice(1) + "), ";
		const proTagQuery =
			`INSERT INTO ${protocolName}_TAG VALUES ` +
			bracketValue.repeat(tagList.length).slice(0, -2);

		const proTagParams = tagList.map(tag => Object.values(tag)).flat();

		const bracketValueTag = "(" + ",?".repeat(2).slice(1) + "), ";
		const tagQuery =
			`INSERT INTO TAG VALUES ` +
			bracketValueTag.repeat(tagList.length).slice(0, -2);
		const values = [];
		tagList.forEach(tag =>
			values.push({
				deviceID: tag.deviceID,
				name: tag.name,
			})
		);
		const tagParams = values.map((value) => Object.values(value)).flat();

		return { proTagQuery, proTagParams, tagQuery, tagParams };
	};

	getAll = async function (req, res) {
		try {
			const devices = await deviceModel.getAll();
			const data = devices.map(device => renameObjectKey(
				device, "protocolType", "protocol"
			));
			res.json(data);
		} catch (err) {
			// Log message
			res.status(INTERNAL_SERVER_ERROR_CODE).json({ msg: "Query fail" })
		}
	};

	// Refactor
	createMany(req, res) {
		const { data, repNum: replicateNumber } = req.body;
		const hasTag = data.tagList.length > 0;

		let deviceList = [];
		const insertManyDeviceQuery = `
            INSERT INTO DEVICE VALUES
            ${"(?, ?, ?, ? ,? ,? ,?, ?),".repeat(replicateNumber).slice(0, -1)}
        `;

		const protocolName = data.protocol.toUpperCase();
		let config = Object.values(data.config);
		let configList = [];
		let configBracketStr = "(" + ",?".repeat(config.length + 1).slice(1) + "),";
		const insertManyDeviceConfigQuery = `
            INSERT INTO ${protocolName} VALUES
            ${configBracketStr.repeat(replicateNumber).slice(0, -1)}
        `;

		let tagListAll = [];
		const insertManyTagQuery = `
            INSERT INTO TAG (deviceID, name) VALUES
            ${"(?, ?),"
				.repeat(replicateNumber * data.tagList.length)
				.slice(0, -1)}
        `;

		let protocolTagListAll = [];
		let proTagBracketValue = hasTag
			? "(" +
			",?".repeat(Object.values(data.tagList[0]).length + 1).slice(1) +
			"),"
			: "()";
		const insertManyProtocolTagQuery = `
            INSERT INTO ${protocolName}_TAG VALUES
            ${proTagBracketValue
				.repeat(replicateNumber * data.tagList.length)
				.slice(0, -1)}
        `;

		const device = [
			data.description,
			data.protocol.toUpperCase(),
			data.byteOrder,
			data.wordOrder,
			data.scanningCycle,
			data.minRespTime,
		];

		const range = [...Array(replicateNumber).keys()];

		const keyList = [];
		for (let i in range) {
			let deviceID = uniqueId();
			keyList.push(deviceID);
			let deviceName = data.name + `_${i}`;

			deviceList.push([deviceID, deviceName, ...device]);

			let tagList = data.tagList.map((tag) => [deviceID, tag.name]);
			tagListAll.push(tagList);

			let protocolTagList = data.tagList.map((tag) => [
				...Object.values(tag),
				deviceID,
			]);
			protocolTagListAll.push(protocolTagList);

			configList.push([...config], deviceID);
		}

		deviceList = deviceList.flat();
		tagListAll = tagListAll.flat(2);
		protocolTagListAll = protocolTagListAll.flat(2);
		configList = configList.flat();

		handler(res, async () => {
			try {
				await dbRun("BEGIN TRANSACTION");
				await dbRun(insertManyDeviceQuery, deviceList);
				await dbRun(insertManyDeviceConfigQuery, configList);

				if (hasTag) {
					await dbRun(insertManyTagQuery, tagListAll);
					await dbRun(insertManyProtocolTagQuery, protocolTagListAll);
				}
				await dbRun("COMMIT");

				res.json({
					keyList,
				});
			} catch (e) {
				await dbRun("ROLLBACK TRANSACTION");
				throw e;
			}
		});
	}

	// Refactor
	create(req, res) {
		const deviceID = uniqueId();
		const { data } = req.body;
		const deviceQuery = `
			INSERT INTO DEVICE (
				ID, name, description, protocolType, 
				byteOrder, wordOrder, scanningCycle, minRespTime
			) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`;
		const protocolName = data.protocol.toUpperCase();

		const deviceParams = [
			deviceID,
			data.name,
			data.description,
			protocolName,
			data.byteOrder,
			data.wordOrder,
			data.scanningCycle,
			data.minRespTime,
		]

		let protocolParams = Object.values(data.config);

		const tagList = data.tagList;

		handler(res, async () => {
			if (protocolParams.length === 0) {
				const infoProTable = await dbAll(`PRAGMA table_info(${protocolName})`);
				protocolParams = Array(infoProTable.length - 1).fill(null);
			}

			protocolParams.push(deviceID);
			const protocolQuery = `INSERT INTO ${protocolName} VALUES (${",?"
				.repeat(protocolParams.length)
				.slice(1)})`;

			if (tagList.length !== 0 && Object.keys(tagList[0]).length !== 0) {
				const { proTagQuery, proTagParams, tagQuery, tagParams } =
					this.setupTagSql(tagList, protocolName, deviceID);

				try {
					await Promise.all([
						dbRun(deviceQuery, deviceParams),
						dbRun(protocolQuery, protocolParams),
						dbRun(tagQuery, tagParams),
						dbRun(proTagQuery, proTagParams),
					]);
				} catch (err) {
					await this.handleErrCreate(deviceID);
					throw err;
				}
			} else {
				try {
					await Promise.all([
						dbRun(deviceQuery, deviceParams),
						dbRun(protocolQuery, protocolParams),
					]);
				} catch (err) {
					await this.handleErrCreate(deviceID);
					throw err;
				}
			}
			res.json({
				keyList: [deviceID],
			});
		});
	}

	getConfigById = async function (req, res) {
		const deviceID = req.query.id;
		const protocolName = req.query.protocol.toUpperCase();
		try {
			const configs = await deviceModel.getConfig(deviceID, protocolName)
			configs.length === 0 ? res.json([]) : res.json(configs[0])
		}
		catch (err) {
			logError(err.message)
			res.status(INTERNAL_SERVER_ERROR_CODE).send({ msg: err.message })
		}
	};

	updateById = async (req, res) => {
		const deviceID = req.query.id;
		const protocolName = req.body.protocol.toUpperCase();
		const tagList = req.body.tagList;

		try {
			await deviceModel.update(deviceID, req.body, req.body.config, tagList, protocolName)
			res.json({ key: deviceID });
		} catch (err) {
			logError(err.message)
			console.error(err)
			res.status(INTERNAL_SERVER_ERROR_CODE).send({ msg: err.message })
		}
	};

	drop = async function (req, res) {
		const deviceID = req.query.id;
		try {
			await deviceModel.drop(deviceID)
			res.json({ key: deviceID });
		} catch (err) {
			logError(err.message)
			res.status(INTERNAL_SERVER_ERROR_CODE).json({ msg: err.message })
		}
	};
}

const deviceController = new DeviceController()

module.exports = deviceController;
