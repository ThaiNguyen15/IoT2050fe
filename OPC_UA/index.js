const express = require('express')
const cors = require('cors')
const port = 4004
const app = express()

const redis = require('./redis/redisClient')

const DeviceConnection = require('./controllers/opcuaClient')
const pool = new DeviceConnection()

app.use(cors())

app.get('/poweron', function (req, res) {
    pool.poweron(req.query.deviceID)
    res.json({msg: 'oke'})
})

app.get('/shutdown', function (req, res) {
    pool.shutdown(req.query.deviceID)
    res.json({msg: 'oke'})
})

app.listen(port, function () {
    redis.pub2Redis('log', {
        serviceName: 'OPC_UA',
        level: 'info',
        errMsg: `Server OPC_UA is listening on port ${port}!`,
    })
    console.log(`Server OPC_UA is listening on port ${port}!`)
})
