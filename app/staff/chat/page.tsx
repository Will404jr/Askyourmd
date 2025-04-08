"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Search } from "lucide-react";
import Pusher from "pusher-js";
import { type User, users } from "@/lib/user";
import { useRouter } from "next/navigation";

interface UnreadCount {
  _id: string;
  count: number;
}

const ChatInterface = () => {
  const [message, setMessage] = useState("");
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<{
    [key: string]: Array<{
      id: number;
      sender: string;
      content: string;
      timestamp: string;
      isSent: boolean;
    }>;
  }>({});
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>(
    {}
  );
  const router = useRouter();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, messages]);

  useEffect(() => {
    const fetchSession = async () => {
      const response = await fetch("/api/session");
      const session = await response.json();
      if (session.isLoggedIn && session.username) {
        const user = users.find((u) => u.username === session.username);
        if (user) {
          setCurrentUser(user);
        }
      } else {
        router.push("/login");
      }
    };
    fetchSession();
  }, [router]);

  useEffect(() => {
    if (currentUser?.personnelType === "Staff") {
      const md = users.find((user) => user.personnelType === "Md");
      if (md) {
        setSelectedContact(md);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (currentUser && selectedContact) {
        const response = await fetch(
          `/api/get-messages?userId=${currentUser.id}&otherUserId=${selectedContact.id}`
        );
        if (response.ok) {
          const fetchedMessages = await response.json();
          setMessages((prevMessages) => {
            const updatedMessages = {
              ...prevMessages,
              [selectedContact.id]: fetchedMessages.map((msg: any) => ({
                id: msg._id,
                sender:
                  msg.senderId === currentUser.id
                    ? currentUser.username
                    : selectedContact.username,
                content: msg.message,
                timestamp: new Date(msg.timestamp).toLocaleTimeString(),
                isSent: msg.senderId === currentUser.id,
              })),
            };

            // Schedule a scroll to bottom after state update
            setTimeout(scrollToBottom, 0);

            return updatedMessages;
          });
        }
      }
    };
    fetchMessages();
  }, [currentUser, selectedContact, scrollToBottom]);

  useEffect(() => {
    if (!currentUser) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    });

    const channel = pusher.subscribe(`private-user-${currentUser.id}`);
    channel.bind("new-message", (data: { sender: User; message: string }) => {
      setMessages((prevMessages) => {
        const updatedMessages = {
          ...prevMessages,
          [data.sender.id]: [
            ...(prevMessages[data.sender.id] || []),
            {
              id: Date.now(),
              sender: data.sender.username,
              content: data.message,
              timestamp: new Date().toLocaleTimeString(),
              isSent: false,
            },
          ],
        };

        // Schedule a scroll to bottom after state update
        setTimeout(scrollToBottom, 0);

        return updatedMessages;
      });

      // Update unread count for the sender
      setUnreadCounts((prevCounts) => ({
        ...prevCounts,
        [data.sender.id]: (prevCounts[data.sender.id] || 0) + 1,
      }));
    });

    return () => {
      pusher.unsubscribe(`private-user-${currentUser.id}`);
    };
  }, [currentUser, scrollToBottom]);

  useEffect(() => {
    const fetchUnreadCounts = async () => {
      if (currentUser && currentUser.personnelType === "Md") {
        const response = await fetch(
          `/api/unread-messages?userId=${currentUser.id}`
        );
        if (response.ok) {
          const unreadCountsData: UnreadCount[] = await response.json();
          const countsObject = unreadCountsData.reduce(
            (acc, { _id, count }) => {
              acc[_id] = count;
              return acc;
            },
            {} as { [key: string]: number }
          );
          setUnreadCounts(countsObject);
        }
      }
    };

    fetchUnreadCounts();
    // Set up an interval to fetch unread counts periodically
    const intervalId = setInterval(fetchUnreadCounts, 30000); // every 30 seconds

    return () => clearInterval(intervalId);
  }, [currentUser]);

  const filteredContacts = users.filter(
    (user) =>
      user.id !== currentUser?.id &&
      user.personnelType === "Staff" &&
      user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSend = async () => {
    if (message.trim() && selectedContact && currentUser) {
      const newMessage = {
        senderId: currentUser.id,
        recipientId: selectedContact.id,
        message: message,
        timestamp: new Date().toISOString(),
      };

      try {
        const response = await fetch("/api/send-message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newMessage),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        setMessages((prevMessages) => {
          const updatedMessages = {
            ...prevMessages,
            [selectedContact.id]: [
              ...(prevMessages[selectedContact.id] || []),
              {
                id: Date.now(),
                sender: currentUser.username,
                content: message,
                timestamp: new Date().toLocaleTimeString(),
                isSent: true,
              },
            ],
          };

          // Schedule a scroll to bottom after state update
          setTimeout(scrollToBottom, 0);

          return updatedMessages;
        });

        setMessage("");
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  return (
    <main className="container mx-auto px-4 py-2">
      <div className="max-w-6xl mx-auto p-6">
        <Card className="h-[600px] flex bg-white shadow-lg">
          {currentUser?.personnelType === "Md" && (
            <div className="w-80 border-r flex flex-col">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search contacts..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="h-full">
                  <div className="divide-y">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`p-4 hover:bg-gray-50 cursor-pointer ${
                          selectedContact?.id === contact.id ? "bg-gray-50" : ""
                        }`}
                        onClick={() => setSelectedContact(contact)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-semibold">
                              {contact.username.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">
                              {contact.username}
                            </h3>
                            <p className="text-sm text-gray-500 truncate">
                              {contact.email}
                            </p>
                          </div>
                          {unreadCounts[contact.id] > 0 && (
                            <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                              {unreadCounts[contact.id]}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="flex-1 flex flex-col rounded-lg">
            {selectedContact && (
              <div className="p-4 border-b flex items-center gap-3 bg-white rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">
                    {selectedContact.username.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold">{selectedContact.username}</h2>
                  <span className="text-xs text-gray-500">
                    {selectedContact.email}
                  </span>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1" ref={scrollAreaRef}>
              <div className="h-full p-4">
                <div className="space-y-4">
                  {selectedContact &&
                    messages[selectedContact.id]?.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.isSent ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] ${
                            msg.isSent
                              ? "bg-blue-500 text-white rounded-t-2xl rounded-l-2xl"
                              : "bg-gray-100 text-gray-800 rounded-t-2xl rounded-r-2xl"
                          } p-3 shadow-sm`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <span
                            className={`text-xs mt-1 block ${
                              msg.isSent ? "text-blue-100" : "text-gray-500"
                            }`}
                          >
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </ScrollArea>

            <div className="p-4 border-t bg-gray-50">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1"
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                />
                <Button
                  className="bg-blue-600 hover:bg-blue-700 shrink-0"
                  onClick={handleSend}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default ChatInterface;
