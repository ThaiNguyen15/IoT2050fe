var db = require('../../models/database.js')

module.exports.getProtocol = function (req, res) {
    try {
        const sql = 'SELECT * FROM protocol'
        var params = []
        var data = []

        db.all(sql, params, (err, rows) => {
            if (err) {
                res.status(400).json({
                    msg: err.message,
                })
                return
            }

            rows.map((row) => {
                data.push({
                    id: row.ID,
                    name: row.name,
                    attrList: JSON.parse(row.attrList),
                })
            })

            res.json(data)
        })
    } catch (err) {
        res.json({
            msg: err,
        })
    }
}

module.exports.postProtocol = function (req, res) {
    try {
        const sql = 'INSERT INTO protocol (name, attrList) VALUES (?, ?)'
        var params = [req.body.name, JSON.stringify(req.body.attrList)]

        db.run(sql, params, (err) => {
            if (err) {
                res.status(400).json({
                    msg: err.message,
                })
                return
            }

            res.json({
                key: '12345',
            })
        })
    } catch (err) {
        res.json({
            msg: err,
        })
    }
}

module.exports.editProtocol = function (req, res) {
    try {
        const sql = 'UPDATE protocol SET name = ?, attrList = ? WHERE ID = ?'
        var params = [
            req.body.name,
            JSON.stringify(req.body.attrList),
            req.params.id,
        ]

        db.run(sql, params, (err) => {
            if (err) {
                res.status(400).json({
                    msg: err.message,
                })
                return
            }

            res.json({
                key: req.params.id,
            })
        })
    } catch (err) {
        res.json({
            msg: err,
        })
    }
}

module.exports.deleteProtocol = function (req, res) {
    try {
        const sql = 'DELETE FROM protocol WHERE ID = ?'
        var params = [req.params.id]

        db.run(sql, params, (err) => {
            if (err) {
                res.status(400).json({
                    msg: err.message,
                })
                return
            }

            res.json({
                key: req.params.id,
            })
        })
    } catch (err) {
        res.json({
            msg: err,
        })
    }
}
