import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOM_PATTERN, readInviteCode, chooseJoinPayload, buildInviteUrl} from '../public/session-utils.js';

test('valid invitation is extracted from query, including mixed case',()=>{
 assert.equal(readInviteCode('https://pulse.example/?room=ab2c3def'), 'AB2C3DEF');
 assert.equal(readInviteCode('https://pulse.example/?room=AB12CDEF'), null);
 assert.equal(readInviteCode('https://pulse.example/?room=ABIO3DEF'), null);
 assert.equal(readInviteCode('https://pulse.example/?other=42'), null);
 assert.ok(ROOM_PATTERN.test('ABC23DEF'));
});
test('friend invitation overrides the previously restored room',()=>{
 const session={room:'ZZZZ2222',name:'Маша'};
 assert.deepEqual(chooseJoinPayload({pending:null,invitation:'ABCD2345',session,clientId:'some-device-id'}),
   {type:'join-room',room:'ABCD2345',name:'Маша',clientId:'some-device-id'});
 assert.deepEqual(chooseJoinPayload({pending:null,invitation:null,session,clientId:'some-device-id'}),
   {type:'join-room',room:'ZZZZ2222',name:'Маша',clientId:'some-device-id'});
});
test('new visitor receives invitation screen, not a newly created room',()=>{
 assert.equal(chooseJoinPayload({pending:null,invitation:'ABCD2345',session:null,clientId:'id'}),null);
 assert.deepEqual(chooseJoinPayload({pending:{type:'join-room',room:'ABCD2345'},invitation:'ABCD2345',session:null,clientId:'id'}),{type:'join-room',room:'ABCD2345'});
});
test('invite URL always contains existing room code',()=>{
 assert.equal(buildInviteUrl('https://pulse.example/?preview=yes', 'ABCD2345'), 'https://pulse.example/?preview=yes&room=ABCD2345');
 assert.throws(()=>buildInviteUrl('https://pulse.example/', 'INVALID1'),/Invalid/);
});
