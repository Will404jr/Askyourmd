"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Search, Users, X, ArrowLeft } from "lucide-react";
import Pusher from "pusher-js";
import { useRouter } from "next/navigation";

// Define user interfaces based on the new structure
interface AdminUser {
  id: string;
  username: string;
  email: string;
  personnelType: "Md";
}

interface StaffUser {
  id: string; // This will be the uid from LDAP
  username: string; // This will be the cn from LDAP
  email: string; // This will be the mail from LDAP
  personnelType: "Staff";
}

type User = AdminUser | StaffUser;

interface UnreadCount {
  _id: string;
  count: number;
}

interface MessagePreview {
  content: string;
  timestamp: string; // Formatted time for display
  rawTimestamp: Date; // Raw timestamp for sorting
  isRead: boolean;
}

const ChatInterface = () => {
  const [message, setMessage] = useState("");
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState<{
    [key: string]: Array<{
      id: number;
      sender: string;
      content: string;
      timestamp: string;
      isSent: boolean;
    }>;
  }>({});
  const [messagePreviews, setMessagePreviews] = useState<{
    [key: string]: MessagePreview;
  }>({});
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>(
    {}
  );
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const router = useRouter();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if viewport is mobile size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      setShowSidebar(window.innerWidth >= 768);
    };

    // Initial check
    checkScreenSize();

    // Add resize listener
    window.addEventListener("resize", checkScreenSize);

    // Cleanup
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

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

  // Fetch current user session
  useEffect(() => {
    const fetchSession = async () => {
      const response = await fetch("/api/session");
      const session = await response.json();
      if (session.isLoggedIn && session.username) {
        // Create user object from session data
        const user: User = {
          id: session.id,
          username: session.username,
          email: session.email,
          personnelType: session.personnelType,
        };
        setCurrentUser(user);
      } else {
        router.push("/login");
      }
    };
    fetchSession();
  }, [router]);

  // Fetch staff users from LDAP
  useEffect(() => {
    const fetchStaffUsers = async () => {
      if (currentUser?.personnelType === "Md") {
        try {
          const response = await fetch("/api/users");
          if (response.ok) {
            const ldapUsers = await response.json();
            // Map LDAP users to our StaffUser interface
            const mappedUsers: StaffUser[] = ldapUsers.map((user: any) => ({
              id: user.uid,
              username: user.cn,
              email: user.mail || `${user.uid}@example.com`,
              personnelType: "Staff",
            }));
            setStaffUsers(mappedUsers);
          }
        } catch (error) {
          console.error("Error fetching staff users:", error);
        }
      }
    };

    fetchStaffUsers();
  }, [currentUser]);

  // Fetch last message for all contacts on initial load
  useEffect(() => {
    const fetchAllLastMessages = async () => {
      if (
        !currentUser ||
        currentUser.personnelType !== "Md" ||
        !isInitialLoad ||
        staffUsers.length === 0
      )
        return;

      const previews: { [key: string]: MessagePreview } = {};

      // Fetch last message for each staff user
      for (const staffUser of staffUsers) {
        try {
          const response = await fetch(
            `/api/get-last-message?userId=${currentUser.id}&otherUserId=${staffUser.id}`
          );

          if (response.ok) {
            const lastMessage = await response.json();

            if (lastMessage) {
              previews[staffUser.id] = {
                content: lastMessage.message,
                timestamp: new Date(lastMessage.timestamp).toLocaleTimeString(),
                rawTimestamp: new Date(lastMessage.timestamp),
                isRead: true,
              };
            }
          }
        } catch (error) {
          console.error(
            `Error fetching last message for ${staffUser.username}:`,
            error
          );
        }
      }

      setMessagePreviews((prev) => ({ ...prev, ...previews }));
      setIsInitialLoad(false);
    };

    fetchAllLastMessages();
  }, [currentUser, isInitialLoad, staffUsers]);

  // Update message previews when messages change
  useEffect(() => {
    const newPreviews: { [key: string]: MessagePreview } = {};

    Object.entries(messages).forEach(([contactId, contactMessages]) => {
      if (contactMessages.length > 0) {
        const lastMessage = contactMessages[contactMessages.length - 1];
        newPreviews[contactId] = {
          content: lastMessage.content,
          timestamp: lastMessage.timestamp,
          rawTimestamp: new Date(), // This should be the timestamp of the last message
          isRead: unreadCounts[contactId] === 0,
        };
      }
    });

    setMessagePreviews((prev) => ({ ...prev, ...newPreviews }));
  }, [messages, unreadCounts]);

  // Fetch messages between current user and selected contact
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

            // Update message previews
            if (fetchedMessages.length > 0) {
              const lastMsg = fetchedMessages[fetchedMessages.length - 1];
              setMessagePreviews((prev) => ({
                ...prev,
                [selectedContact.id]: {
                  content: lastMsg.message,
                  timestamp: new Date(lastMsg.timestamp).toLocaleTimeString(),
                  rawTimestamp: new Date(lastMsg.timestamp),
                  isRead: true,
                },
              }));
            }

            return updatedMessages;
          });
        }
      }
    };
    fetchMessages();
  }, [currentUser, selectedContact]);

  // Set up Pusher for real-time messaging
  useEffect(() => {
    if (!currentUser) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    });

    const channel = pusher.subscribe(`private-user-${currentUser.id}`);
    channel.bind("new-message", (data: { sender: User; message: string }) => {
      setMessages((prevMessages) => {
        const newMessage = {
          id: Date.now(),
          sender: data.sender.username,
          content: data.message,
          timestamp: new Date().toLocaleTimeString(),
          isSent: false,
        };

        const updatedMessages = {
          ...prevMessages,
          [data.sender.id]: [
            ...(prevMessages[data.sender.id] || []),
            newMessage,
          ],
        };

        // Update message preview for this contact
        setMessagePreviews((prev) => ({
          ...prev,
          [data.sender.id]: {
            content: data.message,
            timestamp: new Date().toLocaleTimeString(),
            rawTimestamp: new Date(),
            isRead: false,
          },
        }));

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
  }, [currentUser]);

  // Fetch unread message counts
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

  const filteredContacts = staffUsers
    .filter(
      (user) =>
        user.id !== currentUser?.id &&
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by message timestamp (newest first)
      const timestampA = messagePreviews[a.id]?.rawTimestamp || new Date(0);
      const timestampB = messagePreviews[b.id]?.rawTimestamp || new Date(0);

      // Compare the actual Date objects
      return timestampB.getTime() - timestampA.getTime();
    });

  const handleSend = async () => {
    if (message.trim() && selectedContact && currentUser) {
      setIsLoading(true);

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

        const newMessageObj = {
          id: Date.now(),
          sender: currentUser.username,
          content: message,
          timestamp: new Date().toLocaleTimeString(),
          isSent: true,
        };

        setMessages((prevMessages) => ({
          ...prevMessages,
          [selectedContact.id]: [
            ...(prevMessages[selectedContact.id] || []),
            newMessageObj,
          ],
        }));

        // Update message preview
        setMessagePreviews((prev) => ({
          ...prev,
          [selectedContact.id]: {
            content: message,
            timestamp: new Date().toLocaleTimeString(),
            rawTimestamp: new Date(),
            isRead: true,
          },
        }));

        setMessage("");
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleContactSelect = (contact: User) => {
    setSelectedContact(contact);

    // Mark messages as read when selecting a contact
    if (unreadCounts[contact.id] > 0) {
      setUnreadCounts((prev) => ({
        ...prev,
        [contact.id]: 0,
      }));

      // Update message preview to mark as read
      if (messagePreviews[contact.id]) {
        setMessagePreviews((prev) => ({
          ...prev,
          [contact.id]: {
            ...prev[contact.id],
            isRead: true,
            rawTimestamp: prev[contact.id].rawTimestamp,
            content: prev[contact.id].content,
            timestamp: prev[contact.id].timestamp,
          },
        }));
      }
    }

    if (isMobile) {
      setShowSidebar(false);
    }
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const getTotalUnread = () => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  };

  // Function to truncate message preview
  const truncateMessage = (text: string, maxLength = 30) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <main className="container mx-auto px-2 md:px-4 py-2">
      <div className="max-w-6xl mx-auto p-2 md:p-6">
        <Card className="h-[600px] flex bg-white shadow-lg overflow-hidden relative">
          {/* Mobile toggle button when in chat view */}
          {isMobile && !showSidebar && selectedContact && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 left-3 z-10 md:hidden"
              onClick={toggleSidebar}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Sidebar for contacts */}
          {currentUser?.personnelType === "Md" && showSidebar && (
            <div
              className={`${
                isMobile ? "w-full" : "w-80"
              } border-r flex flex-col`}
            >
              <div className="p-4 border-b flex justify-between items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search contacts..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2"
                    onClick={toggleSidebar}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                )}
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
                        onClick={() => handleContactSelect(contact)}
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
                            <p
                              className={`text-sm truncate ${
                                messagePreviews[contact.id] &&
                                !messagePreviews[contact.id].isRead
                                  ? "text-gray-900 font-medium"
                                  : "text-gray-500"
                              }`}
                            >
                              {messagePreviews[contact.id]
                                ? truncateMessage(
                                    messagePreviews[contact.id].content
                                  )
                                : ""}
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

          {/* Chat area */}
          <div
            className={`${
              showSidebar && isMobile ? "hidden" : "flex-1"
            } flex flex-col rounded-lg`}
          >
            {selectedContact ? (
              <>
                <div className="p-4 border-b flex items-center gap-3 bg-white rounded-lg">
                  {isMobile && !showSidebar && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={toggleSidebar}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  )}
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">
                      {selectedContact.username.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-semibold">
                      {selectedContact.username}
                    </h2>
                    <span className="text-xs text-gray-500">
                      {selectedContact.email}
                    </span>
                  </div>
                </div>

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
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6">
                {isMobile && (
                  <Button
                    variant="outline"
                    className="mb-4 flex items-center gap-2"
                    onClick={toggleSidebar}
                  >
                    <Users className="h-5 w-5" />
                    <span>View Contacts </span>
                    {getTotalUnread() > 0 && (
                      <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs ml-1">
                        {getTotalUnread()}
                      </span>
                    )}
                  </Button>
                )}
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">
                    No conversation selected
                  </h3>
                  <p>Choose a contact to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
};

export default ChatInterface;
