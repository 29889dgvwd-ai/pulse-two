import React, {useCallback, useState} from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {WebView} from 'react-native-webview';

const APP_URL=process.env.EXPO_PUBLIC_APP_URL || '';
const URL_VALID=/^https:\/\//.test(APP_URL);

export default function App(){
  const [loading,setLoading]=useState(true);
  const onMessage=useCallback(async event=>{
    let message;
    try{message=JSON.parse(event.nativeEvent.data);}catch{return;}
    if(message?.type!=='pulse')return;
    try{
      if(message.kind==='highfive'){
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }else if(message.kind==='support'){
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }else{
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }catch{} // На некоторых устройствах вибрация отключена в настройках ОС.
  },[]);

  if(!URL_VALID){return <View style={styles.error}><Text style={styles.title}>PULSE TWO ✳</Text><Text style={styles.copy}>Добавь HTTPS-адрес опубликованного приложения в файл mobile/.env как EXPO_PUBLIC_APP_URL=https://твой-сайт</Text></View>;}
  return <View style={styles.root}>
    <StatusBar style="light" backgroundColor="#141220" />
    <WebView source={{uri:APP_URL}} originWhitelist={['https://*']} onMessage={onMessage}
      javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
      onLoadEnd={()=>setLoading(false)}
      style={styles.web} />
    {loading&&<View style={styles.loading}><ActivityIndicator size="large" color="#b7a4fd"/></View>}
  </View>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#141220'},web:{flex:1,backgroundColor:'#141220'},loading:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',backgroundColor:'#141220'},error:{flex:1,alignItems:'center',justifyContent:'center',padding:30,backgroundColor:'#141220'},title:{fontSize:28,fontWeight:'900',color:'#b7a4fd',marginBottom:18},copy:{fontSize:15,color:'#f5f2fa',textAlign:'center',lineHeight:24}});
