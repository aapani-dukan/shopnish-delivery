import React from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from "react-native";

import { useQuery, useQueryClient,useMutation } from "@tanstack/react-query";
import {apiRequest} from "../services/queryClient";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
export default function ReturnPickupRequestsScreen({ navigation }: any) {
const { user } = useAuth();

const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/returns/delivery"],
  
queryFn: async () => {
      const response = await api.get("/api/returns/delivery");
      return response.data;
    },
  });
  const requests = data?.data || [];
const assignMutation = useMutation({

  mutationFn: async (id:number)=>{

    return apiRequest(

      "POST",

      `/api/returns/${id}/assign`,

      {}

    );

  },

  onSuccess:()=>{

    queryClient.invalidateQueries({

      queryKey:["/api/returns/delivery"]

    });

  },

  onError:()=>{

    Alert.alert(

      "Error",

      "Pickup Assign nahi hua"

    );

  }

});
if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <FlatList
      data={requests}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 48, paddingBottom: 100,  }}
      ListEmptyComponent={() => (
        <View style={styles.center}>
          <Text>No Pickup Requests</Text>
        </View>
      )}

      renderItem={({ item }) => (

        <View style={styles.card}>

          <View style={{ flexDirection: "row" }}>

            <Image
              source={{
                uri: item.product?.image,
              }}
              style={styles.image}
            />

            <View
              style={{
                flex: 1,
                marginLeft: 12,
              }}
            >

              <Text style={styles.title}>
                {item.product?.name}
              </Text>

              <Text>
                Customer :
                {" "}
                {item.customer?.name}
              </Text>

              <Text>
                Seller :
                {" "}
                {item.seller?.businessName}
              </Text>

              <Text>
                Reason :
                {" "}
                {item.reason}
              </Text>

              <Text>
                Pickup Fee :
                ₹{item.pickupFee}
              </Text>

            </View>

          </View>

         {item.status === "accepted" && (

<TouchableOpacity

style={styles.button}

onPress={()=>

assignMutation.mutate(item.id)

}

>

<Text style={styles.buttonText}>

Accept Pickup

</Text>

</TouchableOpacity>

)}
{item.status==="assigned" &&

item.deliveryBoyId===user?.id && (

<TouchableOpacity

style={styles.button}

onPress={()=>navigation.navigate(

"PickupReturn",

{

returnId:item.id

}

)}

>

<Text style={styles.buttonText}>

Pickup Complete

</Text>

</TouchableOpacity>

)}
{item.status==="picked_up" && (

<Text

style={{

marginTop:10,

color:"#f59e0b",

fontWeight:"700"

}}

>

Waiting Seller Approval

</Text>

)}
{item.status==="completed" && (

<Text

style={{

marginTop:10,

color:"green",

fontWeight:"700"

}}

>

Completed

</Text>

)}
        </View>

      )}
    />
  );

}

const styles = StyleSheet.create({

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 24,
    marginBottom: 12,
    elevation: 3,
    fontFamily: "Poppins_400Regular",
    fontSize: 18,
    
  },

  image: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },

  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },

  button: {
    marginTop: 15,
    backgroundColor: "#16a34a",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },

});