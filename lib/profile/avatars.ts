export const avatarOptions = [
  { path: "/profile-images/voters/tanner-meeves.webp", label: "Tanner" },
  { path: "/profile-images/voters/roman-vish.webp", label: "Roman" },
  { path: "/profile-images/voters/nathan-johnson.webp", label: "Nathan" },
  { path: "/profile-images/voters/michael-skye.webp", label: "Michael Skye" },
  { path: "/profile-images/voters/michael-frodsham.webp", label: "Michael Frodsham" },
  { path: "/profile-images/voters/jack-wooley.webp", label: "Jack" },
  { path: "/profile-images/voters/daniel-tree.webp", label: "Daniel" },
  { path: "/profile-images/voters/carter-reeves.webp", label: "Carter" },
  { path: "/profile-images/voters/carson-halls.webp", label: "Carson" },
] as const;

export const avatarPaths = avatarOptions.map((avatar) => avatar.path);
