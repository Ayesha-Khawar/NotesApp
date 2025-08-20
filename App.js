import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, Text, Modal, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Appbar, FAB, Chip } from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function App() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [filter, setFilter] = useState('all');
  const [image, setImage] = useState(null);
  const [recording, setRecording] = useState(null);
  const [audioUri, setAudioUri] = useState(null);

  useEffect(() => {
    loadNotes();
  }, []);

  const saveNotes = async (newNotes) => {
    try {
      await AsyncStorage.setItem('notes', JSON.stringify(newNotes));
      setNotes(newNotes);
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const loadNotes = async () => {
    try {
      const storedNotes = await AsyncStorage.getItem('notes');
      if (storedNotes) setNotes(JSON.parse(storedNotes));
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const addOrUpdateNote = () => {
    const noteData = {
      title,
      text,
      tags: tags.split(',').map(t => t.trim()),
      image,
      audioUri,
    };

    if (editNote) {
      const updatedNotes = notes.map(note =>
        note.id === editNote.id
          ? { ...note, ...noteData }
          : note
      );
      saveNotes(updatedNotes);
      setEditNote(null);
    } else if (title.trim() || text.trim() || image || audioUri) {
      const newNote = {
        id: Date.now().toString(),
        ...noteData,
        favorite: false,
        archived: false,
      };
      saveNotes([newNote, ...notes]);
    }

    resetNoteInputs();
  };

  const resetNoteInputs = () => {
    setTitle('');
    setText('');
    setTags('');
    setImage(null);
    setAudioUri(null);
    setModalVisible(false);
  };

  const deleteNote = (id) => {
    Alert.alert("Delete Note", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        onPress: () => {
          const updatedNotes = notes.filter(note => note.id !== id);
          saveNotes(updatedNotes);
        }
      }
    ]);
  };

  const toggleArchive = (id) => {
    const updatedNotes = notes.map(note =>
      note.id === id ? { ...note, archived: !note.archived } : note
    );
    saveNotes(updatedNotes);
  };

  const toggleFavorite = (id) => {
    const updatedNotes = notes.map(note =>
      note.id === id ? { ...note, favorite: !note.favorite } : note
    );
    saveNotes(updatedNotes);
  };

  const openEditModal = (note) => {
    setEditNote(note);
    setTitle(note.title);
    setText(note.text);
    setTags(note.tags.join(', '));
    setImage(note.image || null);
    setAudioUri(note.audioUri || null);
    setModalVisible(true);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      setRecording(recording);
    } catch (err) {
      console.error('Recording error:', err);
    }
  };

  const stopRecording = async () => {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setAudioUri(uri);
    } catch (err) {
      console.error('Stop recording error:', err);
    }
  };

  const filteredNotes = notes.filter(note =>
    (filter === 'favorite' ? note.favorite : filter === 'archived' ? note.archived : !note.archived) &&
    (note.title.includes(searchQuery) || note.text.includes(searchQuery))
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, darkMode && { backgroundColor: '#121212' }]}>
        <Appbar.Header style={{ backgroundColor: darkMode ? '#1E1E1E' : '#7F5539' }}>
          <Appbar.Content title="Notes" titleStyle={{ color: '#FFF' }} />
          <Appbar.Action icon={darkMode ? "weather-sunny" : "weather-night"} color="#FFF" onPress={() => setDarkMode(!darkMode)} />
        </Appbar.Header>

        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor={darkMode ? "#AAA" : "#000"}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <View style={styles.filterContainer}>
          <Chip icon="star" selected={filter === 'favorite'} onPress={() => setFilter(filter === 'favorite' ? 'all' : 'favorite')} style={[styles.filterChip, filter === 'favorite' && styles.selectedChip]}>
            Favorites
          </Chip>
          <Chip icon="archive" selected={filter === 'archived'} onPress={() => setFilter(filter === 'archived' ? 'all' : 'archived')} style={[styles.filterChip, filter === 'archived' && styles.selectedChip]}>
            Archived
          </Chip>
        </View>

        <ScrollView style={styles.notesContainer}>
          {filteredNotes.map((note) => (
            <TouchableOpacity key={note.id} style={styles.note} onPress={() => openEditModal(note)}>
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={styles.noteText}>{note.text}</Text>
              {note.image && <Image source={{ uri: note.image }} style={styles.noteImage} />}
              {note.audioUri && (
                <TouchableOpacity onPress={() => {
                  const sound = new Audio.Sound();
                  sound.loadAsync({ uri: note.audioUri }).then(() => sound.playAsync());
                }}>
                  <Text style={styles.audioPlayText}>▶️ Play Audio</Text>
                </TouchableOpacity>
              )}
              <View style={styles.tagsContainer}>
                {note.tags.map((tag, index) => (
                  <Chip key={index} style={styles.tag}>{tag}</Chip>
                ))}
              </View>
              <View style={styles.noteActions}>
                <TouchableOpacity onPress={() => toggleFavorite(note.id)}>
                  <Icon name={note.favorite ? "heart" : "heart-outline"} size={20} color={note.favorite ? "red" : "#7F5539"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleArchive(note.id)}>
                  <Icon name={note.archived ? "archive" : "archive-outline"} size={20} color="#7F5539" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteNote(note.id)}>
                  <Icon name="trash-can-outline" size={20} color="#7F5539" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => setModalVisible(true)} />

        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <TextInput style={styles.titleInput} placeholder="Title" value={title} onChangeText={setTitle} />
              <TextInput style={styles.input} placeholder="Write your note..." value={text} onChangeText={setText} multiline />
              <TextInput style={styles.tagsInput} placeholder="Tags (comma separated)" value={tags} onChangeText={setTags} />

              {image && <Image source={{ uri: image }} style={styles.previewImage} />}
              {audioUri && <Text style={styles.audioNoteText}>🎙️ Voice Note Recorded</Text>}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <TouchableOpacity style={styles.smallButton} onPress={pickImage}>
                  <Text style={styles.saveButtonText}>📸 Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.smallButton} onPress={recording ? stopRecording : startRecording}>
                  <Text style={styles.saveButtonText}>{recording ? '⏹️ Stop' : '🎙️ Record'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={addOrUpdateNote}>
                <Text style={styles.saveButtonText}>{editNote ? 'Update' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5E6C8', padding: 20 },
  searchInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 10 },
  notesContainer: { flex: 1 },
  note: { padding: 15, marginBottom: 10, backgroundColor: '#EAD7BB', borderRadius: 10, elevation: 3 },
  noteTitle: { fontSize: 18, fontWeight: 'bold' },
  noteText: { fontSize: 16, color: '#6B4F4F' },
  noteImage: { height: 120, marginTop: 8, borderRadius: 8 },
  tagsContainer: { flexDirection: 'row', marginTop: 5 },
  filterContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 10 },
  filterChip: { marginHorizontal: 5, backgroundColor: '#EAD7BB' },
  selectedChip: { backgroundColor: '#7F5539', color: '#FFF' },
  tag: { marginRight: 5, backgroundColor: '#B08968' },
  noteActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { width: '90%', backgroundColor: '#FFF', padding: 20, borderRadius: 10 },
  titleInput: { borderBottomWidth: 1, borderColor: '#CCC', fontSize: 18, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#CCC', padding: 10, borderRadius: 8, fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
  tagsInput: { borderWidth: 1, borderColor: '#CCC', padding: 10, borderRadius: 8, fontSize: 16, marginTop: 8 },
  saveButton: { backgroundColor: '#7F5539', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#FFF', fontWeight: 'bold' },
  smallButton: { backgroundColor: '#B08968', padding: 10, borderRadius: 8 },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#7F5539' },
  previewImage: { height: 100, marginTop: 10, borderRadius: 10 },
  audioNoteText: { fontStyle: 'italic', marginTop: 8 },
  audioPlayText: { marginTop: 8, color: '#007AFF' },
});
