import React, { useState } from "react";

import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from "react-native";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "../services/queryClient";

export default function PickupReturnScreen({
  route,
  navigation,
}: any) {

  const { returnId } = route.params;

  const queryClient = useQueryClient();

  const [refundPhonePe, setRefundPhonePe] = useState("");

  const [refundUpi, setRefundUpi] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/returns/${returnId}`],
  });

  if (isLoading) {

    return (

      <View style={styles.center}>

        <ActivityIndicator size="large" />

      </View>

    );

  }

  const request = data?.data;

  const address = request?.deliveryAddress;

  const openMap = () => {

    if (!address) return;

    if (address.latitude && address.longitude) {

      Linking.openURL(

        `https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`

      );

      return;

    }

    Linking.openURL(

      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        address.address
      )}`

    );

  };
const mutation = useMutation({

  mutationFn: async () => {

    if (!refundPhonePe.trim() && !refundUpi.trim()) {

      Alert.alert(
        "Required",
        "PhonePe Number ya UPI ID zarur bhare."
      );

      return;

    }

    return apiRequest(

      "POST",

      `/api/returns/${returnId}/pickup`,

      {

        refundPhonePe,

        refundUpi,

      }

    );

  },

  onSuccess: () => {

    queryClient.invalidateQueries({
      queryKey: ["/api/returns/delivery"],
    });

    Alert.alert(
      "Success",
      "Pickup Completed Successfully"
    );

    navigation.goBack();

  },

  onError: () => {

    Alert.alert(
      "Error",
      "Pickup Complete nahi ho saka."
    );

  },

});
  return (

    <ScrollView
      contentContainerStyle={styles.container}
    >

      <Image
        source={{
          uri: request?.product?.image,
        }}
        style={styles.image}
      />

      <Text style={styles.title}>
        {request?.product?.name}
      </Text>

      <View style={styles.card}>

        <Text style={styles.label}>
          Customer
        </Text>

        <Text style={styles.value}>
          {request?.customer?.name}
        </Text>

        <Text style={styles.label}>
          Mobile
        </Text>

        <Text style={styles.value}>
          {address?.phone || "-"}
        </Text>

        <Text style={styles.label}>
          Pickup Address
        </Text>

        <Text style={styles.value}>
          {address?.address}
        </Text>

        <TouchableOpacity
          style={styles.mapButton}
          onPress={openMap}
        >

          <Text style={styles.mapButtonText}>
            Open In Google Maps
          </Text>

        </TouchableOpacity>

        <Text style={styles.label}>
          Pickup Fee
        </Text>

        <Text style={styles.pickupFee}>
          ₹{request?.pickupFee}
        </Text>

      </View>

      <TextInput
        placeholder="Refund PhonePe Number"
        value={refundPhonePe}
        onChangeText={setRefundPhonePe}
        style={styles.input}
      />

      <TextInput
        placeholder="Refund UPI ID"
        value={refundUpi}
        onChangeText={setRefundUpi}
        style={styles.input}
        autoCapitalize="none"
      />
      <TouchableOpacity

  style={styles.button}

  disabled={mutation.isPending}

  onPress={() => mutation.mutate()}

>

  <Text style={styles.buttonText}>

    {mutation.isPending
      ? "Please Wait..."
      : "Pickup Complete"}

  </Text>

</TouchableOpacity>

      {/* Mutation + Button Part-2 में आएगा */}

    </ScrollView>

  );

}
const styles = StyleSheet.create({

  container: {

    padding: 15,

    backgroundColor: "#fff",

  },

  center: {

    flex: 1,

    justifyContent: "center",

    alignItems: "center",

  },

  image: {

    width: 120,

    height: 120,

    alignSelf: "center",

    borderRadius: 10,

    marginBottom: 15,

  },

  title: {

    fontSize: 20,

    fontWeight: "700",

    textAlign: "center",

    marginBottom: 15,

  },

  card: {

    backgroundColor: "#f8fafc",

    borderRadius: 10,

    padding: 15,

    marginBottom: 20,

  },

  label: {

    fontWeight: "700",

    color: "#64748b",

    marginTop: 8,

  },

  value: {

    color: "#111827",

    marginTop: 3,

  },

  pickupFee: {

    color: "#16a34a",

    fontWeight: "700",

    fontSize: 18,

    marginTop: 5,

  },

  input: {

    borderWidth: 1,

    borderColor: "#d1d5db",

    borderRadius: 8,

    paddingHorizontal: 12,

    paddingVertical: 10,

    marginBottom: 15,

  },

  mapButton: {

    marginTop: 12,

    backgroundColor: "#2563eb",

    padding: 10,

    borderRadius: 8,

    alignItems: "center",

  },

  mapButtonText: {

    color: "#fff",

    fontWeight: "700",

  },

  button: {

    backgroundColor: "#16a34a",

    padding: 15,

    borderRadius: 10,

    alignItems: "center",

    marginTop: 10,

    marginBottom: 30,

  },

  buttonText: {

    color: "#fff",

    fontSize: 16,

    fontWeight: "700",

  },

});