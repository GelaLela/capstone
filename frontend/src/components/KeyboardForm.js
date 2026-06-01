import React from "react";
import {
  KeyboardAvoidingView, ScrollView, Platform,
  TouchableWithoutFeedback, Keyboard, StyleSheet,
} from "react-native";
import { COLORS } from "../theme";

export default function KeyboardForm({
  children,
  style,
  contentStyle,
  backgroundColor,
}) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: backgroundColor || COLORS.screenBg }, style]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {children}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:    { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 48 },
});