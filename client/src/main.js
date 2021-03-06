import { Elm } from './Main.elm'
import io from 'socket.io-client'

const config = {
  socket: {
    server: process.env.WEBSOCKET_SERVER || 'http://localhost:3000'
  },
  rtc: {
    connection: {
      iceServers: [
        { url: process.env.STUN_SERVER || 'stun:stun.l.google.com:19302' }
      ]
    },
    channel: {
      ordered: false,
      maxRetransmits: 0
    },
    sdp: {
      mandatory: {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: false
      }
    }
  }
}

// WebRTC stuff
const debug = label => thing => console.log(label, thing) || thing

const onOfferCreated = ({ connection, socket }) => (description) => {
  connection.setLocalDescription(description)
  socket.emit('offer-created', description)
}

const onIceCandidate = ({ socket }) => ({ candidate }) =>
  candidate && socket.emit('ice-candidate', debug('local candidate')(candidate))

const onChannelOpen = channel => (_event) => {
  console.log('open', channel)
  setInterval(_ => channel.send('ping'), 100)
}

const connect = () => {
  const socket = io(config.socket.server)

  socket.on('connect', _ => {
    const connection = new window.RTCPeerConnection(config.rtc.connection)
    const channel = connection.createDataChannel('dc', config.rtc.channel)

    channel.onmessage = debug('onChannelMessage')
    channel.onopen = onChannelOpen(channel)
    channel.onclose = debug('onChannelClose')
    channel.onerror = debug('onerror')

    connection.onicecandidate = onIceCandidate({ socket })

    connection.createOffer(
      onOfferCreated({ connection, socket }),
      _ => undefined,
      config.sdp
    )

    socket.on('answer', answer =>
      connection.setRemoteDescription(new window.RTCSessionDescription(answer))
    )

    socket.on('candidate', candidate => {
      candidate && (console.log('remote candidate', candidate) || connection.addIceCandidate(new RTCIceCandidate(candidate)))
    })
  })

  socket.on('disconnect', debug('disconnect'))
}

const app = Elm.Main.init({
  node: document.getElementById('app')
})

app.ports.outgoing.subscribe(connect)
