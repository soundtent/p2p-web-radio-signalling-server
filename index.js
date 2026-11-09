/* Imports
--------------------------------------------- */

import { createServer } from 'http';
import { Server } from 'socket.io';

//https://stackoverflow.com/questions/69099763/referenceerror-require-is-not-defined-in-es-module-scope-you-can-use-import-in
import { createRequire } from "module";
const require = createRequire(import.meta.url); 
var geoip = require('geoip-lite');

/* Variables
--------------------------------------------- */
const PORT = 5002;
const SIGNALLING_SERVER_PATH = "/p2p-web-radio/signalling-server/";

var peers = [];

const httpServer = createServer();
const io = new Server(httpServer, {
    path: SIGNALLING_SERVER_PATH,
    cors: {
        origin: '*', //`http://localhost:${PORT}`,
        methods: ['GET', 'POST']
    }
});

function sendPeers() {
    for (var i=0;i<peers.length;i++) {
        let peersWithoutMyself = peers.filter( (_, index) => index !== i); //use filter rather than splice, because splice changes the original array
        io.to(peers[i].id).emit('peers', {peers: peersWithoutMyself});
    }
}

io.on('connection', (socket) => {
    console.log(`Connected: ${socket.id}`);

    //get client ip from the x-forwarded-for header (https://socket.io/how-to/get-the-ip-address-of-the-client)
    //forwarded by nginx
    let clientIp = socket.handshake.headers["x-forwarded-for"].split(",")[0];

    let newPeer = {
        id: socket.id,
        ip: clientIp,
        geolocation: "unknown",
    }

    var geo = geoip.lookup(clientIp);
    if (geo) {
        let locationParts = []
        if (geo.country != "") {
           locationParts.push(geo.country);
        }
        if (geo.region != "") {
            locationParts.push(geo.region);
        }
        if (geo.city != "") {
            locationParts.push(geo.city);
        }
        newPeer.geolocation = locationParts.join(", ")
    }

    peers.push(newPeer);

    console.log("Peers: "+JSON.stringify(peers));

    // the connecting node sometimes doesn't get the message without this timeout.
    setTimeout(sendPeers, 1000);

    socket.on('whoami', () => {
        let peer = peers.find(obj => { return obj.id === socket.id });
        io.to(socket.id).emit('whoami', peer);
    });
    
    socket.on('offer', ({ targetPeerId, sessionDesc }) => {
        console.log(`Received offer from ${socket.id} to ${targetPeerId}`);
        if (peers.some(e => e.id == targetPeerId) ) {
            io.to(targetPeerId).emit('offer', { fromId: socket.id, sessionDesc: sessionDesc});
        }
    });

    socket.on('answer', ({ targetPeerId, sessionDesc }) => {
        console.log(`Received answer from ${socket.id} to ${targetPeerId}`);
        if (peers.some(e => e.id == targetPeerId) ) {
            io.to(targetPeerId).emit('answer', { fromId: socket.id, sessionDesc: sessionDesc});
        }
    });

    socket.on('ice-candidate', ({ targetPeerId, candidate }) => {
        io.to(targetPeerId).emit('ice-candidate', { fromId: socket.id, candidate: candidate});
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);
        
        // Clean up peers and connections
        peers = peers.filter(function( obj ) { return obj.id != socket.id; });

        sendPeers();
    });
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Signaling server running on port ${PORT}`);
});