// Небольшой WebSocket-сервер для прототипа без внешних зависимостей.
// Поддержка RFC 6455: Upgrade, masked text frames, ping/pong, close.
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';

export class WebSocket extends EventEmitter {
  static OPEN=1;
  static CLOSED=3;
  readyState=1;
  buffer=Buffer.alloc(0);
  constructor(socket,initial=Buffer.alloc(0),maxPayload=16000){
    super();this.socket=socket;this.maxPayload=maxPayload;
    socket.on('data',buf=>this.receive(buf));
    socket.on('close',()=>this.finish());
    socket.on('error',err=>this.emit('error',err));
    if(initial.length)queueMicrotask(()=>this.receive(initial));
  }
  send(data){this.frame(1,Buffer.from(String(data)));}
  ping(){this.frame(9,Buffer.alloc(0));}
  pong(payload){this.frame(10,payload);}
  frame(opcode,payload){
    if(this.readyState!==1)return;
    const len=payload.length;
    let header;
    if(len<126){header=Buffer.alloc(2);header[1]=len;}
    else if(len<=65535){header=Buffer.alloc(4);header[1]=126;header.writeUInt16BE(len,2);}
    else{header=Buffer.alloc(10);header[1]=127;header.writeBigUInt64BE(BigInt(len),2);}
    header[0]=0x80|opcode;
    try{this.socket.write(Buffer.concat([header,payload]));}catch{this.terminate();}
  }
  receive(chunk){
    if(this.readyState!==1)return;
    this.buffer=Buffer.concat([this.buffer,chunk]);
    if(this.buffer.length>this.maxPayload+1000){this.terminate();return;}
    while(this.buffer.length>=2){
      const first=this.buffer[0],second=this.buffer[1];
      const opcode=first&15,fin=!!(first&0x80),masked=!!(second&0x80);
      let len=second&127,headerSize=2;
      if(len===126){if(this.buffer.length<4)return;len=this.buffer.readUInt16BE(2);headerSize=4;}
      else if(len===127){if(this.buffer.length<10)return;const long=this.buffer.readBigUInt64BE(2);if(long>BigInt(this.maxPayload)){this.terminate();return;}len=Number(long);headerSize=10;}
      if(!masked||!fin||len>this.maxPayload){this.terminate();return;}
      if(this.buffer.length<headerSize+4+len)return;
      const mask=this.buffer.subarray(headerSize,headerSize+4);
      const body=Buffer.from(this.buffer.subarray(headerSize+4,headerSize+4+len));
      this.buffer=this.buffer.subarray(headerSize+4+len);
      for(let i=0;i<body.length;i++)body[i]^=mask[i%4];
      if(opcode===1)this.emit('message',body);
      else if(opcode===8){this.close();return;}
      else if(opcode===9)this.pong(body);
      else if(opcode===10)this.emit('pong');
      else{this.terminate();return;}
    }
  }
  close(){
    if(this.readyState!==1)return;
    this.frame(8,Buffer.alloc(0));this.readyState=3;
    this.socket.end();this.finish();
  }
  terminate(){if(this.readyState!==1)return;this.readyState=3;this.socket.destroy();this.finish();}
  finish(){if(this._finished)return;this._finished=true;this.readyState=3;this.emit('close');}
}
export class WebSocketServer extends EventEmitter {
  clients=new Set();
  constructor({server,path='/ws',maxPayload=16000}){
    super();
    server.on('upgrade',(req,socket,head)=>{
      if(req.url?.split('?')[0]!==path||req.headers.upgrade?.toLowerCase()!=='websocket'||req.headers['sec-websocket-version']!=='13'||!req.headers['sec-websocket-key']){
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');return;
      }
      const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
      const ws=new WebSocket(socket,head,maxPayload);
      this.clients.add(ws);ws.once('close',()=>this.clients.delete(ws));
      this.emit('connection',ws);
    });
  }
}
