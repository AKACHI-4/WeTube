import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinaryService.js";
import { apiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty (common validation)
  // check user already exists: by username and email both
  // check for images
  // check for avatar
  // upload them cloudinary, avatar check
  // create user object -- in mongo db nosql database objects transferred
  // remove password and refresh token field from response
  // check for user creation
  // return res
  // -- or isko bolte hain logic building

  const { fullname, email, username, password } = req.body;

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new apiError(400, "All fields are Required!!");
  }

  const existedUser = await User.findOne({
    $or: [
      {
        username,
      },
      {
        email,
      },
    ],
  });

  if (existedUser) {
    throw new apiError(409, "User already Exists!!");
  }
  console.log(existedUser);

  console.log(req.files);
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) throw new apiError(400, "User Avatar is Required !!");

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) throw new apiError(400, "User Avatar is Required !!");

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const theUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!theUser)
    throw new apiError(500, "Something went wrong while registering the user.");

  return res
    .status(201)
    .json(new apiResponse(200, theUser, "User successfully registered!!"));
});

export { registerUser };
