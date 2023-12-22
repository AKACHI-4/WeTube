import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinaryService.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    // while saving other properties of model will also kick-in to avoid that we pass one more parameter say `validateBeforeSave`
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new apiError(500, "Something went wrong while generating tokens.");
  }
};

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

  console.log(req.body);

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

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  )
    coverImageLocalPath = req.files.coverImage[0].path;

  if (!avatarLocalPath) throw new apiError(400, "User Avatar is Required !!");

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  let coverImage = null;
  if (coverImageLocalPath)
    coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) throw new apiError(400, "User Avatar is Required !!");

  // user uploaded to database
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // check that whether user is in database or not . ?
  const theUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // if it isn't return that the theresome server side error ..
  if (!theUser)
    throw new apiError(500, "Something went wrong while registering the user.");

  return res
    .status(201)
    .json(new apiResponse(200, theUser, "User successfully registered!!"));
});

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // username or email
  // find the user
  // password check
  // access and refresh token generate
  // and send to user .
  // send token in cookies or secure cookies

  const { username, email, password } = req.body;

  console.log(req.body);

  if (!username && !email)
    throw new apiError(400, "username or email is required.");

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) throw new apiError(404, "User does not exist!");

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) throw new apiError(401, "Invalid user credentials.");

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // returning to user
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // sending access and refersh token into cookies also
  // while sending cookies we have to set some options
  const options = {
    httpOnly: true,
    secure: true,
  };
  // both parameter allow cookies to be modified from the server only as by default can be modified from frontend also

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new apiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully !"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // clear cookies
  // reset refresh token

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "Logged Out Successfully !!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // need the refresh token
  // khn se aayega
  // cookies se access kar skte hain
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  console.log(incomingRefreshToken);

  if (!incomingRefreshToken) throw new apiError(401, "Unauthorized request !!");

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    console.log(decodedToken);

    const user = await User.findById(decodedToken?._id);

    if (!user) throw new apiError(401, "Invalid refersh token !!");

    if (incomingRefreshToken !== user.refreshToken)
      throw new apiError(401, "Refresh token is expired !!");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );
    console.log(accessToken, refreshToken);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new apiResponse(
          200,
          {
            accessToken,
            refreshToken,
          },
          "Access Token Refreshed !!"
        )
      );
  } catch (error) {
    throw new apiError(401, error.message || "Invalid Refresh Token !!");
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
